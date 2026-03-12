// ---------------------------------------------------------------------------
// Scheduling MCP Tools — manage agent schedules and event triggers
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition } from '../types'
import type { Json } from '@/lib/supabase/types'

export const tools: ToolDefinition[] = [
  {
    name: 'create_agent_schedule',
    description: 'Create a new cron schedule for an agent. Starts inactive by default.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent ID to schedule.' },
        name: { type: 'string', description: 'Schedule name (e.g. "daily-report").' },
        prompt: { type: 'string', description: 'Prompt to send the agent on each run.' },
        cron_expression: {
          type: 'string',
          description: 'Cron expression (e.g. "0 9 * * *" for daily at 9am UTC).',
        },
        is_active: { type: 'boolean', description: 'Whether to activate immediately.' },
      },
      required: ['agent_id', 'name', 'prompt', 'cron_expression'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('agent_schedules')
        .insert({
          agent_id: params.agent_id as string,
          name: params.name as string,
          prompt: params.prompt as string,
          cron_expression: params.cron_expression as string,
          is_active: (params.is_active as boolean) || false,
          next_run_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  {
    name: 'update_agent_schedule',
    description: 'Update an existing agent schedule.',
    inputSchema: {
      type: 'object',
      properties: {
        schedule_id: { type: 'string', description: 'Schedule ID to update.' },
        prompt: { type: 'string', description: 'Updated prompt.' },
        cron_expression: { type: 'string', description: 'Updated cron expression.' },
        is_active: { type: 'boolean', description: 'Active state.' },
      },
      required: ['schedule_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (params.prompt !== undefined) updates.prompt = params.prompt
      if (params.cron_expression !== undefined) updates.cron_expression = params.cron_expression
      if (params.is_active !== undefined) updates.is_active = params.is_active

      const { data, error } = await supabase
        .from('agent_schedules')
        .update(updates)
        .eq('id', params.schedule_id as string)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  {
    name: 'delete_agent_schedule',
    description: 'Delete an agent schedule.',
    inputSchema: {
      type: 'object',
      properties: {
        schedule_id: { type: 'string', description: 'Schedule ID to delete.' },
      },
      required: ['schedule_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const { error } = await supabase
        .from('agent_schedules')
        .delete()
        .eq('id', params.schedule_id as string)

      if (error) return { success: false, error: error.message }
      return { success: true, data: { deleted: true } }
    },
  },

  {
    name: 'list_agent_schedules',
    description: 'List agent schedules with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Filter by agent ID.' },
        is_active: { type: 'boolean', description: 'Filter by active state.' },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()
      let query = supabase
        .from('agent_schedules')
        .select('*')
        .order('created_at', { ascending: false })

      if (params.agent_id) query = query.eq('agent_id', params.agent_id as string)
      if (params.is_active !== undefined) query = query.eq('is_active', params.is_active as boolean)

      const { data, error } = await query
      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  {
    name: 'create_agent_trigger',
    description: 'Create an event trigger that fires an agent when a database event occurs.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent ID to trigger.' },
        name: { type: 'string', description: 'Trigger name.' },
        table_name: {
          type: 'string',
          description: 'Database table to watch (e.g. "leads", "support_tickets").',
        },
        event_type: {
          type: 'string',
          enum: ['INSERT', 'UPDATE', 'DELETE'],
          description: 'Database event type. Default INSERT.',
        },
        filter_conditions: {
          type: 'object',
          description: 'JSONB filter conditions matched against the record.',
        },
        prompt_template: {
          type: 'string',
          description: 'Prompt template with {{record}} placeholder for the event data.',
        },
        cooldown_seconds: {
          type: 'number',
          description: 'Minimum seconds between trigger fires. Default 60.',
        },
        is_active: { type: 'boolean', description: 'Whether to activate immediately.' },
      },
      required: ['agent_id', 'name', 'table_name', 'prompt_template'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('agent_triggers')
        .insert({
          agent_id: params.agent_id as string,
          name: params.name as string,
          table_name: params.table_name as string,
          event_type: (params.event_type as string) || 'INSERT',
          filter_conditions: (params.filter_conditions as unknown as Json) || null,
          prompt_template: params.prompt_template as string,
          cooldown_seconds: (params.cooldown_seconds as number) || 60,
          is_active: (params.is_active as boolean) || false,
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  {
    name: 'update_agent_trigger',
    description: 'Update an existing agent trigger.',
    inputSchema: {
      type: 'object',
      properties: {
        trigger_id: { type: 'string', description: 'Trigger ID to update.' },
        prompt_template: { type: 'string', description: 'Updated prompt template.' },
        is_active: { type: 'boolean', description: 'Active state.' },
        cooldown_seconds: { type: 'number', description: 'Updated cooldown.' },
      },
      required: ['trigger_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const updates: Record<string, unknown> = {}
      if (params.prompt_template !== undefined) updates.prompt_template = params.prompt_template
      if (params.is_active !== undefined) updates.is_active = params.is_active
      if (params.cooldown_seconds !== undefined) updates.cooldown_seconds = params.cooldown_seconds

      const { data, error } = await supabase
        .from('agent_triggers')
        .update(updates)
        .eq('id', params.trigger_id as string)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  {
    name: 'delete_agent_trigger',
    description: 'Delete an agent trigger.',
    inputSchema: {
      type: 'object',
      properties: {
        trigger_id: { type: 'string', description: 'Trigger ID to delete.' },
      },
      required: ['trigger_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const { error } = await supabase
        .from('agent_triggers')
        .delete()
        .eq('id', params.trigger_id as string)

      if (error) return { success: false, error: error.message }
      return { success: true, data: { deleted: true } }
    },
  },

  {
    name: 'list_agent_triggers',
    description: 'List agent triggers with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Filter by agent ID.' },
        table_name: { type: 'string', description: 'Filter by table name.' },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()
      let query = supabase
        .from('agent_triggers')
        .select('*')
        .order('created_at', { ascending: false })

      if (params.agent_id) query = query.eq('agent_id', params.agent_id as string)
      if (params.table_name) query = query.eq('table_name', params.table_name as string)

      const { data, error } = await query
      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },
]
