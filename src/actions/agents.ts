'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireAdmin } from '@/lib/auth/helpers'
import { getAnthropic } from '@/lib/claude/client'
import type { Agent, AgentConversation } from '@/types/database'

// ── Agent CRUD ──

export async function getAgents(): Promise<Agent[]> {
  // Conditional admin check: admins see all, non-admins see limited fields
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
  // Conditional admin check: admins see all fields, non-admins see limited
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
  model?: string
  is_active?: boolean
}): Promise<Agent> {
  const { supabase } = await requireAdmin()

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
  const { supabase } = await requireAdmin()

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
  const { supabase } = await requireAdmin()

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

// ── Models ──

export async function getAvailableModels(): Promise<
  { id: string; display_name: string }[]
> {
  await requireAuth()

  const anthropic = getAnthropic()
  const response = await anthropic.models.list({ limit: 100 })

  return response.data
    .map((m) => ({ id: m.id, display_name: m.display_name }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
}

// ── Conversations ──

export async function getConversations(
  agentId: string
): Promise<AgentConversation[]> {
  const { supabase } = await requireAdmin()

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
  const { supabase } = await requireAdmin()

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

// ── User-scoped Conversations (any authenticated user) ──

/**
 * Fetch conversations owned by the current user for a given agent.
 * Uses admin client with manual ownership filtering so it works
 * regardless of RLS (portal users included).
 */
export async function getUserConversations(
  agentId: string
): Promise<Pick<AgentConversation, 'id' | 'agent_id' | 'title' | 'created_at' | 'updated_at'>[]> {
  const { user } = await requireAuth()

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('agent_conversations')
    .select('id, agent_id, title, created_at, updated_at')
    .eq('agent_id', agentId)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    throw new Error(`Failed to fetch conversations: ${error.message}`)
  }

  return data as Pick<AgentConversation, 'id' | 'agent_id' | 'title' | 'created_at' | 'updated_at'>[]
}

/**
 * Load a single conversation with messages, verifying ownership.
 */
export async function getUserConversation(
  id: string
): Promise<AgentConversation> {
  const { user } = await requireAuth()

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('agent_conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`Failed to fetch conversation: ${error.message}`)
  }

  // Verify ownership
  if (data.user_id && data.user_id !== user.id) {
    throw new Error('Access denied')
  }

  return data as AgentConversation
}

// ── Installed Skills ──

export interface InstalledSkill {
  slug: string
  name: string
  description: string
  agents: string[]
  tags: string[]
  invocation: 'user' | 'model' | 'both'
  referenceCount: number
}

/**
 * Get all installed skills from the filesystem. Admin-only.
 */
export async function getInstalledSkills(): Promise<InstalledSkill[]> {
  await requireAdmin()

  const { loadSkills } = await import('@/agents/skills/loader')
  const skills = loadSkills()

  return skills.map((s) => ({
    slug: s.slug,
    name: s.frontmatter.name,
    description: s.frontmatter.description,
    agents: s.frontmatter.agents,
    tags: s.frontmatter.tags,
    invocation: s.frontmatter.invocation,
    referenceCount: s.referenceFiles.length,
  }))
}

export interface SkillDetail {
  slug: string
  name: string
  description: string
  agents: string[]
  tags: string[]
  invocation: 'user' | 'model' | 'both'
  body: string
  referenceFiles: string[]
}

/**
 * Get a single skill by slug with full body content. Admin-only.
 */
export async function getSkill(slug: string): Promise<SkillDetail> {
  await requireAdmin()

  const { loadSkills, clearSkillsCache } = await import(
    '@/agents/skills/loader'
  )
  clearSkillsCache()
  const skills = loadSkills()
  const skill = skills.find((s) => s.slug === slug)

  if (!skill) throw new Error(`Skill "${slug}" not found`)

  return {
    slug: skill.slug,
    name: skill.frontmatter.name,
    description: skill.frontmatter.description,
    agents: skill.frontmatter.agents,
    tags: skill.frontmatter.tags,
    invocation: skill.frontmatter.invocation,
    body: skill.body,
    referenceFiles: skill.referenceFiles,
  }
}

/**
 * Save a skill to disk. Creates new or updates existing. Admin-only.
 */
export async function saveSkill(data: {
  slug: string
  name: string
  description: string
  agents: string[]
  tags: string[]
  invocation: 'user' | 'model' | 'both'
  body: string
}): Promise<void> {
  await requireAdmin()

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(data.slug)) {
    throw new Error('Slug must contain only lowercase letters, numbers, and hyphens')
  }

  const fs = await import('fs')
  const path = await import('path')

  const skillsDir = path.resolve(process.cwd(), 'skills')
  const skillDir = path.join(skillsDir, data.slug)

  // Ensure directories exist
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true })
  }
  if (!fs.existsSync(skillDir)) {
    fs.mkdirSync(skillDir, { recursive: true })
  }

  // Build SKILL.md content
  const frontmatter = [
    '---',
    `name: ${data.name}`,
    `description: ${data.description}`,
    `agents: [${data.agents.join(', ')}]`,
    `tags: [${data.tags.join(', ')}]`,
    `invocation: ${data.invocation}`,
    '---',
  ].join('\n')

  const content = `${frontmatter}\n\n${data.body}\n`

  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8')

  // Clear cache so next load picks up changes
  const { clearSkillsCache } = await import('@/agents/skills/loader')
  clearSkillsCache()
}

/**
 * Delete a skill from disk. Admin-only.
 */
export async function deleteSkill(slug: string): Promise<void> {
  await requireAdmin()

  const fs = await import('fs')
  const path = await import('path')

  const skillDir = path.resolve(process.cwd(), 'skills', slug)
  if (!fs.existsSync(skillDir)) {
    throw new Error(`Skill "${slug}" not found`)
  }

  fs.rmSync(skillDir, { recursive: true, force: true })

  const { clearSkillsCache } = await import('@/agents/skills/loader')
  clearSkillsCache()
}
