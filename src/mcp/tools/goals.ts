// ---------------------------------------------------------------------------
// Goals MCP Tools — create, manage, and track autonomous business goals
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition } from '../types'
import type { Json } from '@/lib/supabase/types'

export const tools: ToolDefinition[] = [
  {
    name: 'create_goal',
    description: 'Create a new business goal. Starts in draft status.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Goal title.' },
        description: { type: 'string', description: 'Detailed goal description.' },
        target_metrics: {
          type: 'object',
          description: 'Target metrics as key-value pairs (e.g. {"subscribers": 1000}).',
        },
        target_date: { type: 'string', description: 'Target date in YYYY-MM-DD format.' },
      },
      required: ['title'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('goals')
        .insert({
          title: params.title as string,
          description: (params.description as string) || null,
          target_metrics: (params.target_metrics as unknown as Json) || null,
          target_date: (params.target_date as string) || null,
          status: 'draft',
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  {
    name: 'activate_goal',
    description: 'Set a goal to active status. The goal engine will begin decomposition and pursuit.',
    inputSchema: {
      type: 'object',
      properties: {
        goal_id: { type: 'string', description: 'Goal ID to activate.' },
      },
      required: ['goal_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('goals')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', params.goal_id as string)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  {
    name: 'pause_goal',
    description: 'Pause an active goal. The goal engine will skip paused goals.',
    inputSchema: {
      type: 'object',
      properties: {
        goal_id: { type: 'string', description: 'Goal ID to pause.' },
      },
      required: ['goal_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('goals')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', params.goal_id as string)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  {
    name: 'update_goal_progress',
    description: 'Update a goal\'s current metrics and/or strategy.',
    inputSchema: {
      type: 'object',
      properties: {
        goal_id: { type: 'string', description: 'Goal ID to update.' },
        current_metrics: {
          type: 'object',
          description: 'Updated current metrics as key-value pairs.',
        },
        strategy: { type: 'string', description: 'Updated strategy text.' },
      },
      required: ['goal_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (params.current_metrics) updates.current_metrics = params.current_metrics as unknown as Json
      if (params.strategy) updates.strategy = params.strategy as string

      const { data, error } = await supabase
        .from('goals')
        .update(updates)
        .eq('id', params.goal_id as string)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  {
    name: 'list_goals',
    description: 'List goals with optional status filter.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'active', 'paused', 'completed', 'abandoned'],
          description: 'Filter by goal status.',
        },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()
      let query = supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false })

      if (params.status) query = query.eq('status', params.status as string)

      const { data, error } = await query
      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  {
    name: 'create_goal_task',
    description: 'Create a task within a goal. Used during goal decomposition by the orchestrator.',
    inputSchema: {
      type: 'object',
      properties: {
        goal_id: { type: 'string', description: 'Parent goal ID.' },
        agent_id: { type: 'string', description: 'Agent ID to execute this task. Optional.' },
        title: { type: 'string', description: 'Task title.' },
        description: { type: 'string', description: 'Detailed task description.' },
        priority: { type: 'number', description: 'Priority (1-10, lower is higher). Default 5.' },
        order_index: { type: 'number', description: 'Execution order. Default 0.' },
      },
      required: ['goal_id', 'title'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('goal_tasks')
        .insert({
          goal_id: params.goal_id as string,
          agent_id: (params.agent_id as string) || null,
          title: params.title as string,
          description: (params.description as string) || null,
          priority: (params.priority as number) || 5,
          order_index: (params.order_index as number) || 0,
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  {
    name: 'complete_goal_task',
    description: 'Mark a goal task as completed with a result summary.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'Task ID to complete.' },
        result: { type: 'string', description: 'Result summary text.' },
      },
      required: ['task_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('goal_tasks')
        .update({
          status: 'completed',
          result: (params.result as string) || null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', params.task_id as string)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  {
    name: 'list_goal_tasks',
    description: 'List tasks for a specific goal, ordered by execution order.',
    inputSchema: {
      type: 'object',
      properties: {
        goal_id: { type: 'string', description: 'Goal ID to list tasks for.' },
      },
      required: ['goal_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('goal_tasks')
        .select('*')
        .eq('goal_id', params.goal_id as string)
        .order('order_index')

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },
]
