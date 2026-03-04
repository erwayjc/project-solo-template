'use server'

import { createClient } from '@/lib/supabase/server'

// ── Memory Management (Admin Only) ──

export async function getAgentMemories(
  agentId: string,
  filters?: { scope?: string; category?: string; limit?: number }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  const limit = filters?.limit ?? 50

  let query = supabase
    .from('agent_memories')
    .select('id, agent_id, scope, customer_id, content, category, importance, source_conversation_id, metadata, created_at, updated_at')
    .eq('agent_id', agentId)
    .order('importance', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filters?.scope) query = query.eq('scope', filters.scope)
  if (filters?.category) query = query.eq('category', filters.category)

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch memories: ${error.message}`)
  }

  return data
}

export async function deleteAgentMemory(memoryId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  const { error } = await supabase
    .from('agent_memories')
    .delete()
    .eq('id', memoryId)

  if (error) {
    throw new Error(`Failed to delete memory: ${error.message}`)
  }
}

export async function getAgentHandoffs(agentId: string, status?: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  let query = supabase
    .from('agent_handoffs')
    .select('*')
    .eq('target_agent_id', agentId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch handoffs: ${error.message}`)
  }

  return data
}

export async function getMemoryStats() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  // Run all count queries in parallel instead of sequentially
  const scopes = ['customer', 'business', 'agent', 'conversation'] as const

  const [totalResult, embeddedResult, ...scopeResults] = await Promise.all([
    supabase.from('agent_memories').select('*', { count: 'exact', head: true }),
    supabase.from('agent_memories').select('*', { count: 'exact', head: true }).not('embedding', 'is', null),
    ...scopes.map((scope) =>
      supabase.from('agent_memories').select('*', { count: 'exact', head: true }).eq('scope', scope)
    ),
  ])

  if (totalResult.error) {
    throw new Error(`Failed to fetch memory stats: ${totalResult.error.message}`)
  }

  const totalCount = totalResult.count ?? 0
  const embeddedCount = embeddedResult.count ?? 0
  const scopeCounts: Record<string, number> = {}
  scopes.forEach((scope, i) => {
    scopeCounts[scope] = scopeResults[i].count ?? 0
  })

  return {
    total: totalCount,
    byScope: scopeCounts,
    withEmbeddings: embeddedCount,
    withoutEmbeddings: totalCount - embeddedCount,
  }
}
