// ---------------------------------------------------------------------------
// Task Runner — wraps AgentEngine with safety rails for autonomous execution
// ---------------------------------------------------------------------------

import { createAdminClient } from '../src/lib/supabase/admin'
import { AgentEngine } from '../src/agents/engine'
import { McpClient } from '../src/mcp/client'
import type { ToolCall } from '../src/agents/types'
import type { Json } from '../src/lib/supabase/types'
import { log, logRunStart, logRunComplete } from './logger'

export interface TaskRunConfig {
  agentId: string
  prompt: string
  triggerType: 'schedule' | 'event' | 'goal' | 'manual'
  triggerId?: string
  userId: string
  conversationId?: string
}

export interface TaskRunResult {
  runId: string
  status: 'completed' | 'failed'
  response: string
  toolCalls: ToolCall[]
  tokensUsed: number
  durationMs: number
}

const MAX_RUNS_PER_HOUR = parseInt(process.env.MAX_RUNS_PER_HOUR || '20', 10)
const MAX_RUNS_PER_DAY = parseInt(process.env.MAX_RUNS_PER_DAY || '200', 10)
const MAX_TOKENS_PER_DAY = parseInt(process.env.MAX_TOKENS_PER_DAY || '500000', 10)
const AGENT_TIMEOUT_MS = parseInt(process.env.AGENT_TIMEOUT_MS || '120000', 10)
const MAX_GLOBAL_RUNS_PER_HOUR = parseInt(process.env.MAX_GLOBAL_RUNS_PER_HOUR || '100', 10)

export async function runAgentTask(config: TaskRunConfig): Promise<TaskRunResult> {
  const admin = createAdminClient()
  const startTime = Date.now()

  // Safety rail: global hourly rate limit across all agents
  const { count: globalHourlyCount } = await admin
    .from('agent_runs')
    .select('id', { count: 'exact', head: true })
    .gte('started_at', new Date(Date.now() - 3600000).toISOString())
    .in('status', ['running', 'completed'])

  if ((globalHourlyCount ?? 0) >= MAX_GLOBAL_RUNS_PER_HOUR) {
    log('warn', 'task-runner', 'Global hourly rate limit exceeded', {
      globalHourlyCount,
      limit: MAX_GLOBAL_RUNS_PER_HOUR,
    })
    throw new Error(`Global hourly rate limit exceeded (${globalHourlyCount}/${MAX_GLOBAL_RUNS_PER_HOUR})`)
  }

  // Safety rail: per-agent hourly rate limit
  const { count: hourlyCount } = await admin
    .from('agent_runs')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', config.agentId)
    .gte('started_at', new Date(Date.now() - 3600000).toISOString())
    .in('status', ['running', 'completed'])

  if ((hourlyCount ?? 0) >= MAX_RUNS_PER_HOUR) {
    log('warn', 'task-runner', 'Per-agent hourly rate limit exceeded', {
      agentId: config.agentId,
      hourlyCount,
      limit: MAX_RUNS_PER_HOUR,
    })
    throw new Error(`Agent ${config.agentId} hourly rate limit exceeded (${hourlyCount}/${MAX_RUNS_PER_HOUR})`)
  }

  // Safety rail: per-agent daily run limit
  const { data: agentStatus } = await admin
    .from('agent_status')
    .select('runs_today, errors_today')
    .eq('agent_id', config.agentId)
    .single()

  if ((agentStatus?.runs_today ?? 0) >= MAX_RUNS_PER_DAY) {
    log('warn', 'task-runner', 'Per-agent daily run limit exceeded', {
      agentId: config.agentId,
      runsToday: agentStatus?.runs_today,
      limit: MAX_RUNS_PER_DAY,
    })
    throw new Error(`Agent ${config.agentId} daily run limit exceeded`)
  }

  // Safety rail: per-agent daily token budget
  const { data: tokenData } = await admin
    .from('agent_runs')
    .select('tokens_used')
    .eq('agent_id', config.agentId)
    .gte('started_at', new Date(Date.now() - 86400000).toISOString())

  const tokensUsedToday = (tokenData ?? []).reduce(
    (sum, r) => sum + ((r.tokens_used as number) ?? 0),
    0
  )

  if (tokensUsedToday >= MAX_TOKENS_PER_DAY) {
    log('warn', 'task-runner', 'Per-agent daily token budget exceeded', {
      agentId: config.agentId,
      tokensUsedToday,
      limit: MAX_TOKENS_PER_DAY,
    })
    throw new Error(`Agent ${config.agentId} daily token budget exceeded`)
  }

  // Insert run record
  const { data: run, error: insertError } = await admin
    .from('agent_runs')
    .insert({
      agent_id: config.agentId,
      trigger_type: config.triggerType,
      trigger_id: config.triggerId || null,
      status: 'running',
      prompt: config.prompt,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !run) {
    throw new Error(`Failed to create agent_runs record: ${insertError?.message}`)
  }

  const runId = run.id as string
  logRunStart(config.agentId, config.triggerType, config.triggerId)

  // Update agent_status to running
  await admin
    .from('agent_status')
    .update({
      status: 'running',
      current_task: config.prompt.substring(0, 200),
      last_active_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('agent_id', config.agentId)

  const mcpClient = new McpClient()
  let result: TaskRunResult

  try {
    await mcpClient.loadInternalTools()
    const engine = new AgentEngine(mcpClient)

    // Run with timeout — clearTimeout ensures we don't leak timers
    const enginePromise = engine.run(
      config.agentId,
      config.prompt,
      config.userId,
      config.conversationId
    )

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Execution timeout')), AGENT_TIMEOUT_MS)
    })

    const engineResult = await Promise.race([enginePromise, timeoutPromise])
    clearTimeout(timeoutId)

    const durationMs = Date.now() - startTime
    const tokensUsed = engineResult.tokensUsed ?? 0

    // Update run as completed
    await admin
      .from('agent_runs')
      .update({
        status: 'completed',
        response: engineResult.response,
        tool_calls: (engineResult.toolCalls ?? []) as unknown as Json,
        tokens_used: tokensUsed,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)

    result = {
      runId,
      status: 'completed',
      response: engineResult.response,
      toolCalls: engineResult.toolCalls ?? [],
      tokensUsed,
      durationMs,
    }

    logRunComplete(runId, 'completed', durationMs, tokensUsed)
  } catch (err) {
    const durationMs = Date.now() - startTime
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'

    await admin
      .from('agent_runs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)

    await admin
      .from('agent_status')
      .update({
        status: 'idle',
        current_task: null,
        errors_today: ((agentStatus?.errors_today as number) ?? 0) + 1,
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('agent_id', config.agentId)

    logRunComplete(runId, 'failed', durationMs)

    result = {
      runId,
      status: 'failed',
      response: errorMessage,
      toolCalls: [],
      tokensUsed: 0,
      durationMs,
    }

    return result
  } finally {
    mcpClient.disconnect()
  }

  // Update agent_status to idle on success
  const currentStatus = await admin
    .from('agent_status')
    .select('runs_today')
    .eq('agent_id', config.agentId)
    .single()

  await admin
    .from('agent_status')
    .update({
      status: 'idle',
      current_task: null,
      runs_today: ((currentStatus.data?.runs_today as number) ?? 0) + 1,
      last_active_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('agent_id', config.agentId)

  return result
}
