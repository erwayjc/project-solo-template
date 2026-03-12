// ---------------------------------------------------------------------------
// Worker Structured Logger
// ---------------------------------------------------------------------------
// Writes JSON to stdout for Railway log collection.

type LogLevel = 'info' | 'warn' | 'error'

export function log(
  level: LogLevel,
  component: string,
  message: string,
  data?: Record<string, unknown>
) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    ...data,
  }
  console.log(JSON.stringify(entry))
}

export function logRunStart(
  agentId: string,
  triggerType: string,
  triggerId?: string
) {
  log('info', 'task-runner', 'Agent run started', {
    agentId,
    triggerType,
    triggerId,
  })
}

export function logRunComplete(
  runId: string,
  status: string,
  durationMs: number,
  tokensUsed?: number
) {
  log('info', 'task-runner', 'Agent run completed', {
    runId,
    status,
    durationMs,
    tokensUsed,
  })
}
