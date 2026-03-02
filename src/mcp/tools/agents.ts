// ---------------------------------------------------------------------------
// Agent Management Tools
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // create_agent
  // -----------------------------------------------------------------------
  {
    name: 'create_agent',
    description:
      'Create a new custom agent with a specific role, system prompt, and tool/data permissions. Custom agents extend the platform capabilities for specialised workflows.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name for the agent.' },
        slug: {
          type: 'string',
          description: 'URL-safe identifier (lowercase, hyphens). Must be unique.',
        },
        description: { type: 'string', description: 'Short description of the agent role.' },
        system_prompt: {
          type: 'string',
          description: 'Full system prompt that defines the agent behavior.',
        },
        tools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of tool names this agent is allowed to use.',
        },
        mcp_servers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of MCP server slugs this agent can access.',
        },
        data_access: {
          type: 'object',
          description:
            'Data access permissions. Keys are table names, values are permission levels: "read", "write", or "none".',
        },
        icon: {
          type: 'string',
          description: 'Emoji or icon identifier for the agent.',
        },
      },
      required: ['name', 'slug', 'description', 'system_prompt'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      // Check slug uniqueness
      const { data: existing } = await supabase
        .from('agents')
        .select('id')
        .eq('slug', params.slug as string)
        .single()

      if (existing) {
        return { success: false, error: `Agent slug "${params.slug}" already exists.` }
      }

      const { data, error } = await supabase
        .from('agents')
        .insert({
          name: params.name as string,
          slug: params.slug as string,
          description: (params.description as string) ?? '',
          system_prompt: params.system_prompt as string,
          tools: (params.tools as string[]) ?? [],
          mcp_servers: (params.mcp_servers as string[]) ?? ['internal'],
          data_access: (params.data_access as string[]) ?? [],
          icon: (params.icon as string) ?? undefined,
          is_system: false,
          is_active: true,
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // update_agent
  // -----------------------------------------------------------------------
  {
    name: 'update_agent',
    description:
      'Update an existing agent configuration. Can update name, description, system prompt, tools, data access, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Agent UUID.' },
        updates: {
          type: 'object',
          description: 'Fields to update.',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            system_prompt: { type: 'string' },
            tools: { type: 'array', items: { type: 'string' } },
            mcp_servers: { type: 'array', items: { type: 'string' } },
            data_access: { type: 'object' },
            icon: { type: 'string' },
            is_active: { type: 'boolean' },
          },
        },
      },
      required: ['id', 'updates'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const id = params.id as string
      const updates = params.updates as Record<string, unknown>

      const { data, error } = await supabase
        .from('agents')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // delete_agent
  // -----------------------------------------------------------------------
  {
    name: 'delete_agent',
    description:
      'Delete a custom agent. System agents cannot be deleted. This also removes the agent\'s conversation history.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Agent UUID to delete.' },
      },
      required: ['id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const id = params.id as string

      // Check if it is a system agent
      const { data: agent, error: aErr } = await supabase
        .from('agents')
        .select('id, is_system, name')
        .eq('id', id)
        .single()

      if (aErr) return { success: false, error: aErr.message }

      if (agent.is_system) {
        return {
          success: false,
          error: `Cannot delete system agent "${agent.name}". System agents are protected.`,
        }
      }

      // Delete conversation history first
      await supabase.from('agent_conversations').delete().eq('agent_id', id)

      // Delete the agent
      const { error } = await supabase.from('agents').delete().eq('id', id)

      if (error) return { success: false, error: error.message }
      return { success: true, data: { deleted: id, name: agent.name } }
    },
  },

  // -----------------------------------------------------------------------
  // list_agents
  // -----------------------------------------------------------------------
  {
    name: 'list_agents',
    description:
      'List all configured agents, both system and custom, with their current status and capabilities.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute() {
      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('agents')
        .select('id, name, slug, description, icon, is_system, is_active, tools, mcp_servers, created_at')
        .order('is_system', { ascending: false })
        .order('name', { ascending: true })

      if (error) return { success: false, error: error.message }
      return { success: true, data: { agents: data ?? [] } }
    },
  },
]
