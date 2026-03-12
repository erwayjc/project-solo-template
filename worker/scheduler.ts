// ---------------------------------------------------------------------------
// Scheduler — replaces pg_cron, polls agent_schedules and fires runs
// ---------------------------------------------------------------------------

import cron from 'node-cron'
import { createAdminClient } from '../src/lib/supabase/admin'
import { runAgentTask } from './task-runner'
import { processEmailQueue } from '../src/lib/cron/email-queue'
import { processContentQueue } from '../src/lib/cron/content-queue'
import { runEngagementCheck } from '../src/lib/cron/engagement-check'
import { generateCEOBriefing } from '../src/lib/cron/ceo-briefing'
import { syncStripeData } from '../src/lib/cron/stripe-sync'
import { log } from './logger'

// Legacy cron job names that call extracted functions directly
const LEGACY_CRON_JOBS: Record<string, () => Promise<unknown>> = {
  'process-email-queue': processEmailQueue,
  'process-content-queue': processContentQueue,
  'daily-engagement-check': runEngagementCheck,
  'weekly-ceo-briefing': generateCEOBriefing,
  'stripe-sync': syncStripeData,
}

export interface SchedulerStatus {
  isRunning: boolean
  schedulesLoaded: number
}

export class Scheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private running = new Set<string>()
  private adminUserId: string = ''
  private schedulesLoaded = 0
  private ticking = false

  async start(adminUserId: string) {
    this.adminUserId = adminUserId
    this.intervalId = setInterval(() => this.tick(), 30_000)
    // Run first tick immediately
    await this.tick()
    log('info', 'scheduler', 'Scheduler started')
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    log('info', 'scheduler', 'Scheduler stopped')
  }

  getStatus(): SchedulerStatus {
    return {
      isRunning: this.intervalId !== null,
      schedulesLoaded: this.schedulesLoaded,
    }
  }

  private async tick() {
    // Guard against overlapping ticks (previous tick still running)
    if (this.ticking) return
    this.ticking = true

    const admin = createAdminClient()

    try {
      const { data: schedules, error } = await admin
        .from('agent_schedules')
        .select('*')
        .eq('is_active', true)
        .lte('next_run_at', new Date().toISOString())

      if (error) {
        log('error', 'scheduler', 'Failed to fetch schedules', { error: error.message })
        return
      }

      this.schedulesLoaded = schedules?.length ?? 0

      if (!schedules || schedules.length === 0) return

      for (const schedule of schedules) {
        const scheduleId = schedule.id as string

        // Skip if already running
        if (this.running.has(scheduleId)) continue
        this.running.add(scheduleId)

        try {
          // Skip backlog: if next_run_at is > 1 hour in the past, execute once
          const nextRunAt = new Date(schedule.next_run_at as string)
          const oneHourAgo = new Date(Date.now() - 3600000)

          if (nextRunAt < oneHourAgo) {
            log('info', 'scheduler', 'Skipping backlog, executing once', {
              scheduleId,
              name: schedule.name,
              nextRunAt: schedule.next_run_at,
            })
          }

          // Check if this is a legacy cron job
          const legacyFn = LEGACY_CRON_JOBS[schedule.name as string]

          if (legacyFn) {
            // Run legacy cron function directly
            const startTime = Date.now()
            try {
              const result = await legacyFn()
              const durationMs = Date.now() - startTime

              // Log to agent_runs for audit
              await admin.from('agent_runs').insert({
                agent_id: schedule.agent_id,
                trigger_type: 'schedule',
                trigger_id: scheduleId,
                status: 'completed',
                prompt: schedule.prompt,
                response: JSON.stringify(result),
                duration_ms: durationMs,
                started_at: new Date(startTime).toISOString(),
                completed_at: new Date().toISOString(),
              })

              log('info', 'scheduler', 'Legacy cron job completed', {
                name: schedule.name,
                durationMs,
                result,
              })
            } catch (err) {
              const durationMs = Date.now() - startTime
              const errorMessage = err instanceof Error ? err.message : 'Unknown error'

              await admin.from('agent_runs').insert({
                agent_id: schedule.agent_id,
                trigger_type: 'schedule',
                trigger_id: scheduleId,
                status: 'failed',
                prompt: schedule.prompt,
                error_message: errorMessage,
                duration_ms: durationMs,
                started_at: new Date(startTime).toISOString(),
                completed_at: new Date().toISOString(),
              })

              log('error', 'scheduler', 'Legacy cron job failed', {
                name: schedule.name,
                error: errorMessage,
              })
            }
          } else {
            // Run through agent engine
            await runAgentTask({
              agentId: schedule.agent_id as string,
              prompt: schedule.prompt as string,
              triggerType: 'schedule',
              triggerId: scheduleId,
              userId: this.adminUserId,
            })
          }

          // Calculate next_run_at from cron expression
          const nextDate = getNextCronDate(schedule.cron_expression as string)

          await admin
            .from('agent_schedules')
            .update({
              last_run_at: new Date().toISOString(),
              next_run_at: nextDate.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', scheduleId)
        } catch (err) {
          log('error', 'scheduler', 'Schedule execution failed', {
            scheduleId,
            name: schedule.name,
            error: err instanceof Error ? err.message : 'Unknown',
          })
        } finally {
          this.running.delete(scheduleId)
        }
      }

      // Daily reset of runs_today counters at midnight UTC (widened to 2-min window)
      const now = new Date()
      if (now.getUTCHours() === 0 && now.getUTCMinutes() < 2) {
        await admin
          .from('agent_status')
          .update({ runs_today: 0, errors_today: 0 })
          .neq('agent_id', '00000000-0000-0000-0000-000000000000')
      }
    } catch (err) {
      log('error', 'scheduler', 'Scheduler tick failed', {
        error: err instanceof Error ? err.message : 'Unknown',
      })
    } finally {
      this.ticking = false
    }
  }
}

/**
 * Calculate the next occurrence of a cron expression from now.
 */
function getNextCronDate(cronExpression: string): Date {
  // Use node-cron to validate, then calculate manually
  if (!cron.validate(cronExpression)) {
    throw new Error(`Invalid cron expression: ${cronExpression}`)
  }

  // Parse cron parts: minute hour dayOfMonth month dayOfWeek
  const parts = cronExpression.split(' ')
  const now = new Date()

  // Scan up to 31 days to handle monthly cron expressions
  for (let i = 1; i <= 1440 * 31; i++) {
    const candidate = new Date(now.getTime() + i * 60000)
    if (matchesCron(candidate, parts)) {
      return candidate
    }
  }

  // Fallback: 1 hour from now
  return new Date(now.getTime() + 3600000)
}

function matchesCron(date: Date, parts: string[]): boolean {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  return (
    matchField(date.getUTCMinutes(), minute) &&
    matchField(date.getUTCHours(), hour) &&
    matchField(date.getUTCDate(), dayOfMonth) &&
    matchField(date.getUTCMonth() + 1, month) &&
    matchField(date.getUTCDay(), dayOfWeek)
  )
}

function matchField(value: number, field: string): boolean {
  if (field === '*') return true

  // Handle */N step values
  if (field.startsWith('*/')) {
    const step = parseInt(field.substring(2), 10)
    return value % step === 0
  }

  // Handle comma-separated values
  if (field.includes(',')) {
    return field.split(',').some((v) => parseInt(v, 10) === value)
  }

  // Handle ranges
  if (field.includes('-')) {
    const [min, max] = field.split('-').map((v) => parseInt(v, 10))
    return value >= min && value <= max
  }

  return parseInt(field, 10) === value
}
