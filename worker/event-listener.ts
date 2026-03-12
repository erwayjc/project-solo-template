// ---------------------------------------------------------------------------
// Event Listener — Supabase Realtime subscriptions for agent triggers
// ---------------------------------------------------------------------------

import { createAdminClient } from '../src/lib/supabase/admin'
import { runAgentTask } from './task-runner'
import { log } from './logger'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Allowlist of tables that can be subscribed to via triggers.
// Prevents subscribing to sensitive tables like mcp_connections, profiles, etc.
const ALLOWED_TRIGGER_TABLES = new Set([
  'leads',
  'support_tickets',
  'purchases',
  'blog_posts',
  'content_queue',
  'announcements',
  'lesson_progress',
  'broadcasts',
  'email_sends',
])

export interface EventListenerStatus {
  isRunning: boolean
  triggersLoaded: number
  channelsActive: number
}

interface TriggerConfig {
  id: string
  agent_id: string
  name: string
  table_name: string
  event_type: string
  filter_conditions: Record<string, unknown> | null
  prompt_template: string
  cooldown_seconds: number
  last_triggered_at: string | null
}

export class EventListener {
  private channels: Map<string, RealtimeChannel> = new Map()
  private triggers: TriggerConfig[] = []
  private adminUserId: string = ''
  private reloadIntervalId: ReturnType<typeof setInterval> | null = null
  private retryCount: Map<string, number> = new Map()

  async start(adminUserId: string) {
    this.adminUserId = adminUserId
    await this.loadAndSubscribe()

    // Reload triggers every 5 minutes to pick up config changes
    this.reloadIntervalId = setInterval(() => this.reload(), 300_000)
    log('info', 'event-listener', 'Event listener started', {
      triggers: this.triggers.length,
      channels: this.channels.size,
    })
  }

  stop() {
    if (this.reloadIntervalId) {
      clearInterval(this.reloadIntervalId)
      this.reloadIntervalId = null
    }
    this.unsubscribeAll()
    log('info', 'event-listener', 'Event listener stopped')
  }

  async reload() {
    this.unsubscribeAll()
    await this.loadAndSubscribe()
    log('info', 'event-listener', 'Triggers reloaded', {
      triggers: this.triggers.length,
      channels: this.channels.size,
    })
  }

  getStatus(): EventListenerStatus {
    return {
      isRunning: this.reloadIntervalId !== null,
      triggersLoaded: this.triggers.length,
      channelsActive: this.channels.size,
    }
  }

  private async loadAndSubscribe() {
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('agent_triggers')
      .select('*')
      .eq('is_active', true)

    if (error) {
      log('error', 'event-listener', 'Failed to load triggers', { error: error.message })
      return
    }

    // Filter out triggers targeting disallowed tables
    this.triggers = ((data ?? []) as unknown as TriggerConfig[]).filter((t) => {
      if (!ALLOWED_TRIGGER_TABLES.has(t.table_name)) {
        log('warn', 'event-listener', `Trigger ${t.id} targets disallowed table "${t.table_name}", skipping`)
        return false
      }
      return true
    })

    // Group triggers by table_name
    const triggersByTable = new Map<string, TriggerConfig[]>()
    for (const trigger of this.triggers) {
      const existing = triggersByTable.get(trigger.table_name) || []
      existing.push(trigger)
      triggersByTable.set(trigger.table_name, existing)
    }

    // Create a channel per table
    for (const [tableName, tableTriggers] of triggersByTable) {
      this.subscribeToTable(tableName, tableTriggers)
    }
  }

  private subscribeToTable(tableName: string, tableTriggers: TriggerConfig[]) {
    const supabase = createAdminClient()
    const channelName = `worker-${tableName}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => this.handleEvent(payload, tableTriggers)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.retryCount.set(channelName, 0)
          log('info', 'event-listener', `Subscribed to ${tableName}`)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          log('warn', 'event-listener', `Channel error on ${tableName}`, { status })
          this.handleReconnect(channelName, tableName, tableTriggers)
        }
      })

    this.channels.set(channelName, channel)
  }

  private handleReconnect(
    channelName: string,
    tableName: string,
    tableTriggers: TriggerConfig[]
  ) {
    const retries = (this.retryCount.get(channelName) ?? 0) + 1
    this.retryCount.set(channelName, retries)

    if (retries > 10) {
      log('error', 'event-listener', `Channel ${channelName} exceeded max retries, marking degraded`)
      return
    }

    const backoffMs = Math.min(1000 * Math.pow(2, retries - 1), 60000)

    setTimeout(() => {
      log('info', 'event-listener', `Reconnecting ${channelName} (attempt ${retries})`)
      // Remove old channel
      const oldChannel = this.channels.get(channelName)
      if (oldChannel) {
        createAdminClient().removeChannel(oldChannel)
        this.channels.delete(channelName)
      }
      // Re-subscribe
      this.subscribeToTable(tableName, tableTriggers)
    }, backoffMs)
  }

  private async handleEvent(
    payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> },
    tableTriggers: TriggerConfig[]
  ) {
    for (const trigger of tableTriggers) {
      try {
        // Match event type
        if (trigger.event_type !== '*' && trigger.event_type !== payload.eventType) {
          continue
        }

        // Apply filter conditions
        if (trigger.filter_conditions) {
          const record = payload.new || payload.old
          if (!matchesFilter(record, trigger.filter_conditions)) {
            continue
          }
        }

        // Check cooldown
        if (trigger.last_triggered_at) {
          const lastTriggered = new Date(trigger.last_triggered_at).getTime()
          const cooldownEnd = lastTriggered + trigger.cooldown_seconds * 1000
          if (Date.now() < cooldownEnd) {
            log('info', 'event-listener', 'Trigger skipped (cooldown)', {
              triggerId: trigger.id,
              name: trigger.name,
            })
            continue
          }
        }

        // Build prompt from template — wrap record in XML delimiters to separate
        // data from instructions and mitigate prompt injection via record content
        const recordJson = JSON.stringify(payload.new || payload.old)
        const safeRecord = `<event_data>\n${recordJson}\n</event_data>`
        const prompt = trigger.prompt_template.replace(/\{\{record\}\}/g, safeRecord)

        // Fire agent run
        log('info', 'event-listener', 'Trigger fired', {
          triggerId: trigger.id,
          name: trigger.name,
          table: trigger.table_name,
          event: payload.eventType,
        })

        await runAgentTask({
          agentId: trigger.agent_id,
          prompt,
          triggerType: 'event',
          triggerId: trigger.id,
          userId: this.adminUserId,
        })

        // Update last_triggered_at
        const admin = createAdminClient()
        await admin
          .from('agent_triggers')
          .update({ last_triggered_at: new Date().toISOString() })
          .eq('id', trigger.id)

        // Update in-memory trigger
        trigger.last_triggered_at = new Date().toISOString()
      } catch (err) {
        log('error', 'event-listener', 'Trigger execution failed', {
          triggerId: trigger.id,
          name: trigger.name,
          error: err instanceof Error ? err.message : 'Unknown',
        })
      }
    }
  }

  private unsubscribeAll() {
    // Use a single admin client for all channel removals
    const admin = createAdminClient()
    for (const [, channel] of this.channels) {
      try {
        admin.removeChannel(channel)
      } catch {
        // Ignore removal errors during cleanup
      }
    }
    this.channels.clear()
    this.triggers = []
    this.retryCount.clear()
  }
}

function matchesFilter(
  record: Record<string, unknown>,
  conditions: Record<string, unknown>
): boolean {
  for (const [key, value] of Object.entries(conditions)) {
    if (record[key] !== value) return false
  }
  return true
}
