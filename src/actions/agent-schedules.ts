'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  AgentSchedule,
  AgentTrigger,
  AgentRun,
  AgentStatus,
  Goal,
  GoalTask,
} from '@/types/database'

// Allowlist of tables that triggers can subscribe to
const ALLOWED_TRIGGER_TABLES = [
  'leads', 'support_tickets', 'purchases', 'blog_posts',
  'content_queue', 'announcements', 'lesson_progress',
  'broadcasts', 'email_sends',
]

// Simple cron validation (5 space-separated fields)
const CRON_REGEX = /^(\S+\s+){4}\S+$/

// ── Helper: verify admin ──

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Authentication required')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Admin access required')

  return supabase
}

// ── Schedules ──

export async function getAgentSchedules(agentId?: string): Promise<AgentSchedule[]> {
  const supabase = await requireAdmin()
  let query = supabase
    .from('agent_schedules')
    .select('*')
    .order('created_at', { ascending: false })

  if (agentId) query = query.eq('agent_id', agentId)

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch schedules: ${error.message}`)
  return data as AgentSchedule[]
}

export async function createAgentSchedule(data: {
  agent_id: string
  name: string
  prompt: string
  cron_expression: string
  is_active?: boolean
}): Promise<AgentSchedule> {
  const supabase = await requireAdmin()
  const { data: schedule, error } = await supabase
    .from('agent_schedules')
    .insert({
      ...data,
      is_active: data.is_active ?? false,
      next_run_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create schedule: ${error.message}`)
  return schedule as AgentSchedule
}

export async function updateAgentSchedule(
  id: string,
  data: Partial<Pick<AgentSchedule, 'name' | 'prompt' | 'cron_expression' | 'is_active'>>
): Promise<AgentSchedule> {
  // Validate cron expression if provided
  if (data.cron_expression && !CRON_REGEX.test(data.cron_expression)) {
    throw new Error('Invalid cron expression format')
  }

  const supabase = await requireAdmin()

  // Recalculate next_run_at when re-enabling a schedule
  const updateData: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() }
  if (data.is_active === true) {
    updateData.next_run_at = new Date().toISOString()
  }

  const { data: schedule, error } = await supabase
    .from('agent_schedules')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update schedule: ${error.message}`)
  return schedule as AgentSchedule
}

export async function deleteAgentSchedule(id: string): Promise<void> {
  const supabase = await requireAdmin()
  const { error } = await supabase.from('agent_schedules').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete schedule: ${error.message}`)
}

// ── Triggers ──

export async function getAgentTriggers(agentId?: string): Promise<AgentTrigger[]> {
  const supabase = await requireAdmin()
  let query = supabase
    .from('agent_triggers')
    .select('*')
    .order('created_at', { ascending: false })

  if (agentId) query = query.eq('agent_id', agentId)

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch triggers: ${error.message}`)
  return data as AgentTrigger[]
}

export async function createAgentTrigger(data: {
  agent_id: string
  name: string
  table_name: string
  event_type?: string
  prompt_template: string
  cooldown_seconds?: number
  is_active?: boolean
}): Promise<AgentTrigger> {
  // Validate table_name against allowlist
  if (!ALLOWED_TRIGGER_TABLES.includes(data.table_name)) {
    throw new Error(`Table "${data.table_name}" is not allowed for triggers`)
  }

  const supabase = await requireAdmin()
  const { data: trigger, error } = await supabase
    .from('agent_triggers')
    .insert({
      ...data,
      event_type: data.event_type ?? 'INSERT',
      cooldown_seconds: data.cooldown_seconds ?? 60,
      is_active: data.is_active ?? false,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create trigger: ${error.message}`)
  return trigger as AgentTrigger
}

export async function updateAgentTrigger(
  id: string,
  data: Partial<Pick<AgentTrigger, 'name' | 'table_name' | 'event_type' | 'prompt_template' | 'is_active' | 'cooldown_seconds'>>
): Promise<AgentTrigger> {
  // Validate table_name against allowlist if provided
  if (data.table_name && !ALLOWED_TRIGGER_TABLES.includes(data.table_name)) {
    throw new Error(`Table "${data.table_name}" is not allowed for triggers`)
  }

  const supabase = await requireAdmin()
  const { data: trigger, error } = await supabase
    .from('agent_triggers')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update trigger: ${error.message}`)
  return trigger as AgentTrigger
}

export async function deleteAgentTrigger(id: string): Promise<void> {
  const supabase = await requireAdmin()
  const { error } = await supabase.from('agent_triggers').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete trigger: ${error.message}`)
}

// ── Runs ──

export async function getAgentRuns(agentId?: string, limit = 50): Promise<AgentRun[]> {
  const supabase = await requireAdmin()
  let query = supabase
    .from('agent_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (agentId) query = query.eq('agent_id', agentId)

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch runs: ${error.message}`)
  return data as AgentRun[]
}

// ── Status ──

export async function getAgentStatuses(): Promise<AgentStatus[]> {
  const supabase = await requireAdmin()
  const { data, error } = await supabase.from('agent_status').select('*')

  if (error) throw new Error(`Failed to fetch statuses: ${error.message}`)
  return data as AgentStatus[]
}

// ── Goals ──

export async function getGoals(status?: string): Promise<Goal[]> {
  const supabase = await requireAdmin()
  let query = supabase.from('goals').select('*').order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch goals: ${error.message}`)
  return data as Goal[]
}

export async function createGoal(data: {
  title: string
  description?: string
  target_date?: string
}): Promise<Goal> {
  const supabase = await requireAdmin()
  const { data: goal, error } = await supabase
    .from('goals')
    .insert({
      title: data.title,
      description: data.description || null,
      target_date: data.target_date || null,
      status: 'draft',
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create goal: ${error.message}`)
  return goal as Goal
}

export async function activateGoal(id: string): Promise<Goal> {
  const supabase = await requireAdmin()
  const { data: goal, error } = await supabase
    .from('goals')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to activate goal: ${error.message}`)
  return goal as Goal
}

export async function pauseGoal(id: string): Promise<Goal> {
  const supabase = await requireAdmin()
  const { data: goal, error } = await supabase
    .from('goals')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to pause goal: ${error.message}`)
  return goal as Goal
}

// ── Goal Tasks ──

export async function getGoalTasks(goalIds?: string[]): Promise<GoalTask[]> {
  const supabase = await requireAdmin()
  let query = supabase
    .from('goal_tasks')
    .select('*')
    .order('order_index', { ascending: true })

  if (goalIds && goalIds.length > 0) {
    query = query.in('goal_id', goalIds)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch goal tasks: ${error.message}`)
  return data as GoalTask[]
}
