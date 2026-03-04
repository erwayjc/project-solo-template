// ---------------------------------------------------------------------------
// Agent Memory & Handoff Tools
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition } from '../types'
import type { Json } from '@/lib/supabase/types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // store_memory
  // -----------------------------------------------------------------------
  {
    name: 'store_memory',
    description:
      'Store a persistent memory. The embedding is generated asynchronously. Use this to remember customer preferences, business insights, learnings, or conversation takeaways.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The memory text — what was learned. Keep under 200 words.',
        },
        scope: {
          type: 'string',
          enum: ['customer', 'business', 'agent', 'conversation'],
          description:
            'Memory visibility: customer (per-person), business (shared), agent (private), conversation (thread-scoped).',
        },
        category: {
          type: 'string',
          description:
            'Domain category: preference, insight, behavior, feedback, strategy, outcome, product, campaign, audience, process, general.',
        },
        importance: {
          type: 'number',
          description: 'Priority 1-10 (10 = critical, 1 = minor). Default 5.',
        },
        customer_id: {
          type: 'string',
          description: 'Profile UUID — required for customer-scoped memories.',
        },
        _agent_id: {
          type: 'string',
          description: 'The calling agent ID (injected by engine).',
        },
        _conversation_id: {
          type: 'string',
          description: 'The current conversation ID (injected by engine).',
        },
        metadata: {
          type: 'object',
          description: 'Optional extra context as key-value pairs.',
        },
      },
      required: ['content', 'scope', '_agent_id'],
    },
    async execute(params) {
      // Validate customer_id is provided for customer-scoped memories
      if (params.scope === 'customer' && !params.customer_id) {
        return { success: false, error: 'customer_id is required for customer-scoped memories' }
      }

      // Validate importance range (DB enforces 1-10 but give a clear error)
      const importance = (params.importance as number) ?? 5
      if (importance < 1 || importance > 10) {
        return { success: false, error: 'importance must be between 1 and 10' }
      }

      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('agent_memories')
        .insert({
          agent_id: params._agent_id as string,
          content: params.content as string,
          scope: params.scope as string,
          category: (params.category as string) ?? 'general',
          importance,
          customer_id: (params.customer_id as string) ?? null,
          source_conversation_id: (params._conversation_id as string) ?? null,
          metadata: (params.metadata ?? {}) as unknown as Json,
        })
        .select('id, content, scope, category, importance, created_at')
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // search_memories
  // -----------------------------------------------------------------------
  {
    name: 'search_memories',
    description:
      'Semantic search across agent memories. Generates an embedding for the query and finds similar memories.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search text — will be embedded and compared against stored memories.',
        },
        scope: {
          type: 'string',
          enum: ['customer', 'business', 'agent', 'conversation'],
          description: 'Filter by memory scope. Use "business" for shared insights across all agents.',
        },
        customer_id: {
          type: 'string',
          description: 'Filter by customer profile UUID.',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 10, max 50).',
        },
        threshold: {
          type: 'number',
          description: 'Minimum similarity threshold (default 0.7).',
        },
        _agent_id: {
          type: 'string',
          description: 'The calling agent ID (injected by engine).',
        },
      },
      required: ['query', '_agent_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const query = params.query as string
      const agentId = params._agent_id as string

      // Generate embedding for the search query via Edge Function
      try {
        const embedResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed-memory`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ content: query, action: 'embed-only' }),
          }
        )

        if (!embedResponse.ok) {
          return { success: false, error: 'Failed to generate search embedding' }
        }

        const { embedding } = await embedResponse.json()

        // Scope search by agent ID unless searching business memories (shared)
        const filterAgentId = params.scope === 'business' ? null : agentId

        const { data, error } = await supabase.rpc('match_memories', {
          query_embedding: JSON.stringify(embedding),
          match_threshold: (params.threshold as number) ?? 0.7,
          match_count: Math.min((params.limit as number) ?? 10, 50),
          filter_agent_id: filterAgentId,
          filter_scope: (params.scope as string) ?? null,
          filter_customer_id: (params.customer_id as string) ?? null,
        })

        if (error) return { success: false, error: error.message }
        return { success: true, data: { memories: data, count: (data as unknown[])?.length ?? 0 } }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Search failed',
        }
      }
    },
  },

  // -----------------------------------------------------------------------
  // get_memories
  // -----------------------------------------------------------------------
  {
    name: 'get_memories',
    description:
      'List memories with filters (non-semantic, for browsing). Returns memories ordered by importance and recency.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'Filter by agent UUID.',
        },
        scope: {
          type: 'string',
          enum: ['customer', 'business', 'agent', 'conversation'],
          description: 'Filter by memory scope.',
        },
        customer_id: {
          type: 'string',
          description: 'Filter by customer profile UUID.',
        },
        category: {
          type: 'string',
          description: 'Filter by category tag.',
        },
        limit: {
          type: 'number',
          description: 'Max records (default 50).',
        },
        offset: {
          type: 'number',
          description: 'Records to skip (default 0).',
        },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()
      const limit = Math.min((params.limit as number) ?? 50, 100)
      const offset = (params.offset as number) ?? 0

      let query = supabase
        .from('agent_memories')
        .select('id, agent_id, scope, customer_id, content, category, importance, source_conversation_id, metadata, created_at, updated_at', { count: 'exact' })
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (params.agent_id) query = query.eq('agent_id', params.agent_id as string)
      if (params.scope) query = query.eq('scope', params.scope as string)
      if (params.customer_id) query = query.eq('customer_id', params.customer_id as string)
      if (params.category) query = query.eq('category', params.category as string)

      const { data, error, count } = await query

      if (error) return { success: false, error: error.message }
      return { success: true, data: { memories: data, total: count ?? 0, limit, offset } }
    },
  },

  // -----------------------------------------------------------------------
  // update_memory
  // -----------------------------------------------------------------------
  {
    name: 'update_memory',
    description:
      'Update an existing memory. If content changes, the embedding will be regenerated automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        memory_id: {
          type: 'string',
          description: 'Memory UUID to update.',
        },
        content: {
          type: 'string',
          description: 'New memory text.',
        },
        category: {
          type: 'string',
          description: 'New category tag.',
        },
        importance: {
          type: 'number',
          description: 'New importance 1-10.',
        },
        metadata: {
          type: 'object',
          description: 'New metadata (replaces existing).',
        },
      },
      required: ['memory_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      const updates: Record<string, unknown> = {}
      if (params.content !== undefined) updates.content = params.content
      if (params.category !== undefined) updates.category = params.category
      if (params.importance !== undefined) updates.importance = params.importance
      if (params.metadata !== undefined) updates.metadata = params.metadata as unknown as Json

      if (Object.keys(updates).length === 0) {
        return { success: false, error: 'No fields to update' }
      }

      const { data, error } = await supabase
        .from('agent_memories')
        .update(updates)
        .eq('id', params.memory_id as string)
        .select('id, content, scope, category, importance, updated_at')
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // delete_memory
  // -----------------------------------------------------------------------
  {
    name: 'delete_memory',
    description: 'Permanently remove a memory.',
    inputSchema: {
      type: 'object',
      properties: {
        memory_id: {
          type: 'string',
          description: 'Memory UUID to delete.',
        },
      },
      required: ['memory_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('agent_memories')
        .delete()
        .eq('id', params.memory_id as string)
        .select('id')

      if (error) return { success: false, error: error.message }
      if (!data || data.length === 0) {
        return { success: false, error: `Memory "${params.memory_id}" not found` }
      }
      return { success: true, data: { deleted: params.memory_id } }
    },
  },

  // -----------------------------------------------------------------------
  // create_handoff
  // -----------------------------------------------------------------------
  {
    name: 'create_handoff',
    description:
      'Create a context handoff to another agent. The target agent will receive the summary and any referenced memories on their next conversation turn.',
    inputSchema: {
      type: 'object',
      properties: {
        target_agent_slug: {
          type: 'string',
          description: 'Slug of the target agent (e.g. "support-agent", "sales-strategist").',
        },
        summary: {
          type: 'string',
          description: 'Context summary for the receiving agent.',
        },
        customer_id: {
          type: 'string',
          description: 'Customer profile UUID if relevant.',
        },
        memory_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of memory UUIDs relevant to this handoff.',
        },
        _agent_id: {
          type: 'string',
          description: 'The calling agent ID (injected by engine).',
        },
      },
      required: ['target_agent_slug', 'summary', '_agent_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      // Resolve target agent by slug
      const { data: targetAgent, error: agentErr } = await supabase
        .from('agents')
        .select('id')
        .eq('slug', params.target_agent_slug as string)
        .single()

      if (agentErr || !targetAgent) {
        return { success: false, error: `Agent "${params.target_agent_slug}" not found` }
      }

      const { data, error } = await supabase
        .from('agent_handoffs')
        .insert({
          source_agent_id: params._agent_id as string,
          target_agent_id: targetAgent.id as string,
          customer_id: (params.customer_id as string) ?? null,
          summary: params.summary as string,
          memory_ids: ((params.memory_ids ?? []) as unknown) as Json,
          metadata: {} as unknown as Json,
        })
        .select('id, target_agent_id, summary, status, created_at')
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // get_pending_handoffs
  // -----------------------------------------------------------------------
  {
    name: 'get_pending_handoffs',
    description:
      'Check for pending handoffs assigned to this agent.',
    inputSchema: {
      type: 'object',
      properties: {
        _agent_id: {
          type: 'string',
          description: 'The calling agent ID (injected by engine).',
        },
      },
      required: ['_agent_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('agent_handoffs')
        .select('*')
        .eq('target_agent_id', params._agent_id as string)
        .eq('status', 'pending')
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('created_at', { ascending: false })
        .limit(25)

      if (error) return { success: false, error: error.message }

      // Resolve referenced memory_ids into memory content
      const handoffs = data ?? []
      const allMemoryIds = handoffs.flatMap((h) => (h.memory_ids as string[]) ?? [])

      let memoriesMap: Record<string, { id: string; content: string; scope: string; category: string }> = {}
      if (allMemoryIds.length > 0) {
        const { data: memories } = await supabase
          .from('agent_memories')
          .select('id, content, scope, category')
          .in('id', allMemoryIds)

        if (memories) {
          memoriesMap = Object.fromEntries(memories.map((m) => [m.id, m]))
        }
      }

      // Attach resolved memories to each handoff
      const enrichedHandoffs = handoffs.map((h) => ({
        ...h,
        resolved_memories: ((h.memory_ids as string[]) ?? [])
          .map((id: string) => memoriesMap[id])
          .filter(Boolean),
      }))

      return { success: true, data: { handoffs: enrichedHandoffs, count: enrichedHandoffs.length } }
    },
  },

  // -----------------------------------------------------------------------
  // complete_handoff
  // -----------------------------------------------------------------------
  {
    name: 'complete_handoff',
    description:
      'Mark a handoff as completed after the receiving agent has processed it.',
    inputSchema: {
      type: 'object',
      properties: {
        handoff_id: {
          type: 'string',
          description: 'Handoff UUID to mark as completed.',
        },
      },
      required: ['handoff_id'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('agent_handoffs')
        .update({ status: 'completed' })
        .eq('id', params.handoff_id as string)
        .select('id, status')
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },
]
