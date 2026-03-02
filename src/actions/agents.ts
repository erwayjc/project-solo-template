'use server'

import { createClient } from '@/lib/supabase/server'
import type { Agent, AgentConversation } from '@/types/database'

// ── Agent CRUD ──

export async function getAgents(): Promise<Agent[]> {
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
    // Non-admins only see active agents with limited fields (no system_prompt)
    const { data, error } = await supabase
      .from('agents')
      .select('id, name, slug, description, icon, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch agents: ${error.message}`)
    }

    return data as Agent[]
  }

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch agents: ${error.message}`)
  }

  return data as Agent[]
}

export async function getAgent(id: string): Promise<Agent> {
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
    // Non-admins get limited agent info (no system_prompt, tools, data_access)
    const { data, error } = await supabase
      .from('agents')
      .select('id, name, slug, description, icon, is_active')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error) {
      throw new Error(`Failed to fetch agent: ${error.message}`)
    }

    return data as Agent
  }

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`Failed to fetch agent: ${error.message}`)
  }

  return data as Agent
}

export async function createAgent(agentData: {
  name: string
  slug: string
  description?: string
  system_prompt: string
  tools?: string[]
  mcp_servers?: string[]
  data_access?: string[]
  icon?: string
  is_active?: boolean
}): Promise<Agent> {
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

  const { data, error } = await supabase
    .from('agents')
    .insert(agentData)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create agent: ${error.message}`)
  }

  return data as Agent
}

export async function updateAgent(
  id: string,
  agentData: Partial<Omit<Agent, 'id' | 'created_at'>>
): Promise<Agent> {
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

  const { data, error } = await supabase
    .from('agents')
    .update(agentData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update agent: ${error.message}`)
  }

  return data as Agent
}

export async function deleteAgent(id: string): Promise<void> {
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

  // Prevent deleting system agents
  const { data: agent } = await supabase
    .from('agents')
    .select('is_system')
    .eq('id', id)
    .single()

  if (agent?.is_system) {
    throw new Error('Cannot delete system agents')
  }

  const { error } = await supabase
    .from('agents')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete agent: ${error.message}`)
  }
}

// ── Conversations ──

export async function getConversations(
  agentId: string
): Promise<AgentConversation[]> {
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

  const { data, error } = await supabase
    .from('agent_conversations')
    .select('*')
    .eq('agent_id', agentId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch conversations: ${error.message}`)
  }

  return data as AgentConversation[]
}

export async function getConversation(id: string): Promise<AgentConversation> {
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

  const { data, error } = await supabase
    .from('agent_conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`Failed to fetch conversation: ${error.message}`)
  }

  return data as AgentConversation
}
