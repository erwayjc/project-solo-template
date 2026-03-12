// ---------------------------------------------------------------------------
// Agent Runs MCP Tools — query and manage autonomous agent run history
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  {
    name: 'list_agent_runs',
    description: 'Query agent run history with optional filters. Returns most recent 50 by default.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Filter by agent ID.' },
        trigger_type: {
          type: 'string',
          enum: ['schedule', 'event', 'goal', 'manual'],
          description: 'Filter by trigger type.',
        },
        status: {
          type: 'string',
          enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
          description: 'Filter by run status.',
        },
        limit: { type: 'number', description: 'Max results to return (default 50).' },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()
      let query = supabase
        .from('agent_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit((params.limit as number) || 50)

      if (params.agent_id) query = query.eq('agent_id', params.agent_id as string)
      if (params.trigger_type) query = query.eq('trigger_type', params.trigger_type as string)
      if (params.status) query = query.eq('status', params.status as string)

      const { data, error } = await query
      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  {
    name: 'get_agent_run',
    description: 'Get a single agent run by ID with full response and tool calls.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'The agent run ID.' },
      },
      required: ['run_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('agent_runs')
        .select('*')
        .eq('id', params.run_id as string)
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  {
    name: 'cancel_agent_run',
    description: 'Cancel a pending or running agent run.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'The agent run ID to cancel.' },
      },
      required: ['run_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('agent_runs')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', params.run_id as string)
        .in('status', ['pending', 'running'])
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      if (!data) return { success: false, error: 'Run not found or already completed' }
      return { success: true, data }
    },
  },
]
