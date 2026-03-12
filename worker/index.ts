// ---------------------------------------------------------------------------
// Worker Entry Point — initializes and orchestrates all worker subsystems
// ---------------------------------------------------------------------------

import { createAdminClient } from '../src/lib/supabase/admin'
import { Scheduler } from './scheduler'
import { EventListener } from './event-listener'
import { GoalEngine } from './goal-engine'
import { log } from './logger'

const HEARTBEAT_SENTINEL = '00000000-0000-0000-0000-000000000000'

async function main() {
  // 1. Validate required env vars
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ANTHROPIC_API_KEY',
  ]

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      log('error', 'worker', `Missing required env var: ${varName}. The worker cannot run without it.`)
      process.exit(1)
    }
  }

  // 2. Test Supabase connectivity
  const admin = createAdminClient()
  const { error: connectError } = await admin
    .from('site_config')
    .select('id')
    .eq('id', 1)
    .single()

  if (connectError) {
    log('error', 'worker', `Failed to connect to Supabase: ${connectError.message}`)
    process.exit(1)
  }

  // 3. Clean up orphaned runs from previous crash
  await admin
    .from('agent_runs')
    .update({
      status: 'failed',
      error_message: 'Orphaned by worker restart',
      completed_at: new Date().toISOString(),
    })
    .eq('status', 'running')

  await admin
    .from('agent_status')
    .update({
      status: 'idle',
      current_task: null,
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'running')

  // 4. Fetch admin user ID
  const { data: siteConfig } = await admin
    .from('site_config')
    .select('admin_user_id')
    .eq('id', 1)
    .single()

  const adminUserId = siteConfig?.admin_user_id as string
  if (!adminUserId) {
    log('error', 'worker', 'No admin_user_id in site_config. Run the setup wizard first.')
    process.exit(1)
  }

  // 5. Write initial heartbeat
  await admin
    .from('agent_status')
    .upsert({
      agent_id: HEARTBEAT_SENTINEL,
      status: 'idle',
      updated_at: new Date().toISOString(),
    })

  // 6. Initialize subsystems
  const scheduler = new Scheduler()
  const eventListener = new EventListener()
  const goalEngine = new GoalEngine()

  // 7. Start subsystems
  await scheduler.start(adminUserId)
  await eventListener.start(adminUserId)
  await goalEngine.start(adminUserId)

  // 8. Heartbeat loop — use fresh client each time to avoid stale connections
  const heartbeatInterval = setInterval(async () => {
    try {
      const heartbeatClient = createAdminClient()
      await heartbeatClient
        .from('agent_status')
        .update({ updated_at: new Date().toISOString() })
        .eq('agent_id', HEARTBEAT_SENTINEL)
    } catch (err) {
      log('error', 'worker', 'Heartbeat failed', {
        error: err instanceof Error ? err.message : 'Unknown',
      })
    }
  }, 60_000)

  // 9. Graceful shutdown
  const shutdown = async (signal: string) => {
    log('info', 'worker', `Received ${signal}, shutting down...`)

    goalEngine.stop()
    eventListener.stop()
    scheduler.stop()
    clearInterval(heartbeatInterval)

    // Clear heartbeat
    await admin
      .from('agent_status')
      .update({
        status: 'disabled',
        updated_at: new Date().toISOString(),
      })
      .eq('agent_id', HEARTBEAT_SENTINEL)

    log('info', 'worker', 'Shutdown complete')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // 10. Log startup summary
  const schedulerStatus = scheduler.getStatus()
  const eventStatus = eventListener.getStatus()

  log('info', 'worker', 'Worker started', {
    scheduler: schedulerStatus.isRunning ? 'active' : 'inactive',
    eventListener: `${eventStatus.triggersLoaded} triggers`,
    goalEngine: 'active',
    adminUserId,
  })
}

main().catch((err) => {
  log('error', 'worker', 'Worker crashed', {
    error: err instanceof Error ? err.message : 'Unknown',
    stack: err instanceof Error ? err.stack : undefined,
  })
  process.exit(1)
})
