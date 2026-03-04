// ---------------------------------------------------------------------------
// Agent Execution Engine
// ---------------------------------------------------------------------------
//
// Orchestrates the conversation loop between a user, the Claude API, and the
// MCP tool system. Handles multi-turn tool calls until Claude produces a
// final text response.
// ---------------------------------------------------------------------------

import { getAnthropic } from '@/lib/claude/client'
import type Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { McpClient } from '@/mcp/client'
import type { AgentConfig, AgentMessage, AgentMemory, AgentHandoff, ToolCall } from './types'
import type { ToolDefinition } from '@/mcp/types'
import type { Json } from '@/lib/supabase/types'
import {
  DELEGATION_BLOCKED_TOOLS,
  DELEGATION_MODE_PREAMBLE,
  MAX_DELEGATION_ROUNDS,
  createDelegationTool,
} from './orchestration'
import { getPromptBuilder } from './prompts/index'

// Maximum rounds of tool-use before forcing a text response
const MAX_TOOL_ROUNDS = 15

// ---------------------------------------------------------------------------
// Types for the Anthropic SDK message shapes
// ---------------------------------------------------------------------------

interface AnthropicTextBlock {
  type: 'text'
  text: string
}

interface AnthropicToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock

interface AnthropicToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
}

type AnthropicMessage =
  | { role: 'user'; content: string | AnthropicToolResultBlock[] }
  | { role: 'assistant'; content: AnthropicContentBlock[] }

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class AgentEngine {
  constructor(private mcpClient: McpClient) {}

  /**
   * Run a single user turn against an agent, returning the assistant's
   * final text response along with every tool call that occurred.
   */
  async run(
    agentId: string,
    userMessage: string,
    userId: string,
    conversationId?: string
  ): Promise<{
    response: string
    conversationId: string
    toolCalls: ToolCall[]
  }> {
    const turnStartTime = Date.now()
    const supabase = createAdminClient()

    // -----------------------------------------------------------------
    // 1. Load agent config
    // -----------------------------------------------------------------
    const { data: agentRow, error: agentErr } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single()

    if (agentErr || !agentRow) {
      throw new Error(`Agent "${agentId}" not found: ${agentErr?.message}`)
    }

    const agent: AgentConfig = {
      id: agentRow.id as string,
      name: agentRow.name as string,
      slug: agentRow.slug as string,
      systemPrompt: agentRow.system_prompt as string,
      tools: (agentRow.tools as string[]) ?? [],
      mcpServers: (agentRow.mcp_servers as string[]) ?? ['internal'],
      dataAccess: (agentRow.data_access as unknown as Record<string, 'read' | 'write' | 'none'>) ?? {},
      isSystem: agentRow.is_system as boolean,
    }

    // -----------------------------------------------------------------
    // 2. Load or create conversation (with user ownership check)
    // -----------------------------------------------------------------
    let convId = conversationId
    let history: AgentMessage[] = []

    if (convId) {
      const { data: conv } = await supabase
        .from('agent_conversations')
        .select('messages, user_id')
        .eq('id', convId)
        .single()

      if (conv) {
        // Verify the conversation belongs to this user
        if (conv.user_id && conv.user_id !== userId) {
          throw new Error('Access denied: conversation does not belong to you')
        }
        history = (conv.messages as unknown as AgentMessage[]) ?? []
      }
    }

    if (!convId) {
      const { data: newConv, error: newConvErr } = await supabase
        .from('agent_conversations')
        .insert({
          agent_id: agentId,
          user_id: userId,
          messages: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (newConvErr) throw new Error(`Failed to create conversation: ${newConvErr.message}`)
      convId = newConv.id as string
    }

    // -----------------------------------------------------------------
    // 3. Build master context
    // -----------------------------------------------------------------
    const { data: siteConfig } = await supabase
      .from('site_config')
      .select('*')
      .eq('id', 1)
      .single()

    const masterContext = siteConfig
      ? buildMasterContext(siteConfig as Record<string, unknown>)
      : ''

    // -----------------------------------------------------------------
    // 3b. Retrieve relevant memories for this agent
    // -----------------------------------------------------------------
    let memoryContext = ''
    try {
      const embedResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed-memory`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ content: userMessage, action: 'embed-only' }),
        }
      )
      if (embedResponse.ok) {
        const { embedding } = await embedResponse.json()

        // Query for agent-specific memories
        const { data: memories } = await supabase.rpc('match_memories', {
          query_embedding: JSON.stringify(embedding),
          match_threshold: 0.7,
          match_count: 10,
          filter_agent_id: agent.id,
        })

        // Also fetch business-scope memories (shared across all agents)
        const { data: sharedMemories } = await supabase.rpc('match_memories', {
          query_embedding: JSON.stringify(embedding),
          match_threshold: 0.7,
          match_count: 5,
          filter_scope: 'business',
        })

        // Fetch conversation-scope memories if continuing an existing conversation
        let conversationMemories: { id: string; scope: string; category: string; content: string }[] = []
        if (convId) {
          const { data: convMems } = await supabase
            .from('agent_memories')
            .select('id, agent_id, scope, customer_id, content, category, importance, source_conversation_id, metadata, created_at, updated_at')
            .eq('scope', 'conversation')
            .eq('source_conversation_id', convId)
            .order('importance', { ascending: false })
            .limit(5)
          conversationMemories = (convMems ?? []) as typeof conversationMemories
        }

        // Combine and deduplicate all memory sources
        const seenIds = new Set<string>()
        const allMemories = [
          ...(memories ?? []),
          ...(sharedMemories ?? []),
          ...conversationMemories,
        ].filter((m) => {
          if (seenIds.has(m.id)) return false
          seenIds.add(m.id)
          return true
        })

        if (allMemories.length > 0) {
          memoryContext = buildMemoryContext(allMemories as AgentMemory[])
        }
      }
    } catch (err) {
      // Memory retrieval is non-critical — log and continue without memories
      console.warn('Memory retrieval failed:', err)
    }

    // -----------------------------------------------------------------
    // 3c. Check for pending handoffs (atomic accept to prevent races)
    // -----------------------------------------------------------------
    let handoffContext = ''
    try {
      // Atomically mark pending handoffs as accepted and return them.
      // This prevents concurrent requests from consuming the same handoffs.
      const { data: handoffs } = await supabase
        .from('agent_handoffs')
        .update({ status: 'accepted' })
        .eq('target_agent_id', agent.id)
        .eq('status', 'pending')
        .or('expires_at.is.null,expires_at.gt.now()')
        .select('*')

      if (handoffs && handoffs.length > 0) {
        // Only inject the 3 most recent into context
        const recentHandoffs = handoffs
          .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
          .slice(0, 3)
        handoffContext = buildHandoffContext(recentHandoffs as unknown as AgentHandoff[])
      }
    } catch (err) {
      console.warn('Handoff retrieval failed:', err)
    }

    // -----------------------------------------------------------------
    // 3d. Register delegation tool if agent is orchestration-eligible
    // -----------------------------------------------------------------
    if (agent.tools.includes('delegate_to_agent')) {
      this.mcpClient.addTool(
        createDelegationTool(this, masterContext, convId, turnStartTime)
      )
    }

    // -----------------------------------------------------------------
    // 4. Gather available tools for this agent
    // -----------------------------------------------------------------
    const availableTools = this.mcpClient.getAvailableTools(
      agent.mcpServers.length > 0 ? agent.mcpServers : undefined,
      agent.tools.length > 0 ? agent.tools : undefined
    )

    const claudeTools = availableTools.map(toolToClaudeSchema)

    // -----------------------------------------------------------------
    // 5. Build the initial Claude messages array
    // -----------------------------------------------------------------
    // Use code-maintained prompt file if available, otherwise fall back to DB prompt
    const promptBuilder = getPromptBuilder(agent.slug)
    const basePrompt = promptBuilder
      ? promptBuilder(masterContext)
      : agent.systemPrompt.includes('{{MASTER_CONTEXT}}')
        ? agent.systemPrompt.replace('{{MASTER_CONTEXT}}', masterContext)
        : `${agent.systemPrompt}\n\n---\n\n${masterContext}`

    const systemPrompt = [basePrompt, memoryContext, handoffContext]
      .filter(Boolean)
      .join('\n\n')

    const messages: AnthropicMessage[] = historyToAnthropicMessages(history)

    // Append the new user message
    messages.push({ role: 'user', content: userMessage })

    // -----------------------------------------------------------------
    // 6. Conversation loop (tool use)
    // -----------------------------------------------------------------
    const anthropic = getAnthropic()
    const allToolCalls: ToolCall[] = []
    let finalResponse = ''
    let rounds = 0

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++

      const apiResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools: claudeTools as Anthropic.Messages.Tool[],
        messages: messages as Anthropic.Messages.MessageParam[],
      })

      const contentBlocks = apiResponse.content as AnthropicContentBlock[]

      // Collect any tool_use blocks
      const toolUseBlocks = contentBlocks.filter(
        (b): b is AnthropicToolUseBlock => b.type === 'tool_use'
      )

      // Collect text blocks
      const textBlocks = contentBlocks.filter(
        (b): b is AnthropicTextBlock => b.type === 'text'
      )

      // If no tool_use, we are done
      if (toolUseBlocks.length === 0) {
        finalResponse = textBlocks.map((b) => b.text).join('\n')
        break
      }

      // Push the assistant's response (including tool_use blocks) into messages
      messages.push({ role: 'assistant', content: contentBlocks })

      // Execute each tool and build tool_result blocks
      const toolResults: AnthropicToolResultBlock[] = []

      for (const block of toolUseBlocks) {
        const enrichedInput = {
          ...block.input,
          _agent_id: agent.id,
          _conversation_id: convId,
        }
        const result = await this.mcpClient.executeTool(block.name, enrichedInput)

        const toolCall: ToolCall = {
          id: block.id,
          name: block.name,
          input: block.input,
          result: result,
        }
        allToolCalls.push(toolCall)

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      }

      // Push tool results as the next user message
      messages.push({ role: 'user', content: toolResults })

      // If Claude signalled stop_reason = 'end_turn' but included tool_use,
      // the loop continues. If stop_reason was not tool_use, grab text.
      if (apiResponse.stop_reason === 'end_turn' && toolUseBlocks.length === 0) {
        finalResponse = textBlocks.map((b) => b.text).join('\n')
        break
      }
    }

    // If we exhausted rounds, extract whatever text we have
    if (!finalResponse) {
      finalResponse =
        'I completed the requested operations. Let me know if you need anything else.'
    }

    // -----------------------------------------------------------------
    // 7. Save conversation to DB
    // -----------------------------------------------------------------
    const now = new Date().toISOString()

    history.push({
      role: 'user',
      content: userMessage,
      timestamp: now,
    })

    history.push({
      role: 'assistant',
      content: finalResponse,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      timestamp: now,
    })

    await supabase
      .from('agent_conversations')
      .update({
        messages: history as unknown as Json,
        updated_at: now,
      })
      .eq('id', convId)

    return {
      response: finalResponse,
      conversationId: convId,
      toolCalls: allToolCalls,
    }
  }

  // -----------------------------------------------------------------
  // Delegation — lightweight specialist invocation
  // -----------------------------------------------------------------

  /**
   * Invoke a specialist agent for a delegated task.
   * Unlike run(), this skips conversation persistence, memory retrieval,
   * and handoff processing. The specialist receives only the briefing
   * message and cannot re-delegate (delegate_to_agent is excluded).
   */
  async delegate(
    specialistConfig: AgentConfig,
    briefingMessage: string,
    masterContext: string,
    _conversationId: string,
    timeBudgetMs: number
  ): Promise<{
    response: string
    specialist: string
    toolCalls: string[]
    roundsUsed: number
  }> {
    // Time budget check
    if (timeBudgetMs < 10000) {
      throw new Error('Insufficient time budget for delegation')
    }

    const maxRounds =
      timeBudgetMs < 25000 ? 2 : MAX_DELEGATION_ROUNDS
    const deadline = Date.now() + timeBudgetMs

    // Build specialist system prompt with delegation preamble
    // Use code-maintained prompt file if available, otherwise fall back to DB prompt
    const specialistPromptBuilder = getPromptBuilder(specialistConfig.slug)
    const basePrompt = specialistPromptBuilder
      ? specialistPromptBuilder(masterContext)
      : specialistConfig.systemPrompt.includes('{{MASTER_CONTEXT}}')
        ? specialistConfig.systemPrompt.replace(
            '{{MASTER_CONTEXT}}',
            masterContext
          )
        : `${specialistConfig.systemPrompt}\n\n---\n\n${masterContext}`

    const systemPrompt = `${DELEGATION_MODE_PREAMBLE}\n\n${basePrompt}`

    // Gather specialist tools, excluding delegation tools
    const availableTools = this.mcpClient
      .getAvailableTools(
        specialistConfig.mcpServers.length > 0
          ? specialistConfig.mcpServers
          : undefined,
        specialistConfig.tools.length > 0
          ? specialistConfig.tools
          : undefined
      )
      .filter((t) => !DELEGATION_BLOCKED_TOOLS.includes(t.name))

    const claudeTools = availableTools.map(toolToClaudeSchema)

    // Single user message — no conversation history
    const messages: AnthropicMessage[] = [
      { role: 'user', content: briefingMessage },
    ]

    const anthropic = getAnthropic()
    const toolCallNames: string[] = []
    let finalResponse = ''
    let rounds = 0

    while (rounds < maxRounds) {
      // Timeout enforcement
      if (Date.now() >= deadline) {
        break
      }

      rounds++

      const apiResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools: claudeTools as Anthropic.Messages.Tool[],
        messages: messages as Anthropic.Messages.MessageParam[],
      })

      const contentBlocks =
        apiResponse.content as AnthropicContentBlock[]

      const toolUseBlocks = contentBlocks.filter(
        (b): b is AnthropicToolUseBlock => b.type === 'tool_use'
      )

      const textBlocks = contentBlocks.filter(
        (b): b is AnthropicTextBlock => b.type === 'text'
      )

      // No tool use — we have our final response
      if (toolUseBlocks.length === 0) {
        finalResponse = textBlocks.map((b) => b.text).join('\n')
        break
      }

      // Push assistant response into messages
      messages.push({ role: 'assistant', content: contentBlocks })

      // Execute each tool call
      const toolResults: AnthropicToolResultBlock[] = []

      for (const block of toolUseBlocks) {
        const enrichedInput = {
          ...block.input,
          _agent_id: specialistConfig.id,
        }
        const result = await this.mcpClient.executeTool(
          block.name,
          enrichedInput
        )

        toolCallNames.push(block.name)

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      }

      messages.push({ role: 'user', content: toolResults })
    }

    if (!finalResponse) {
      finalResponse =
        'The specialist completed the requested operations but did not provide a text summary.'
    }

    return {
      response: finalResponse,
      specialist: specialistConfig.name,
      toolCalls: toolCallNames,
      roundsUsed: rounds,
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a ToolDefinition into the Claude API tool schema format.
 * Strips engine-injected parameters (_agent_id, _conversation_id) from
 * the schema so Claude cannot see or hallucinate values for them.
 */
function toolToClaudeSchema(tool: ToolDefinition) {
  const schema = { ...tool.inputSchema }

  // Remove _-prefixed properties (engine-injected at execution time)
  if (schema.properties) {
    const filtered = { ...schema.properties as Record<string, unknown> }
    for (const key of Object.keys(filtered)) {
      if (key.startsWith('_')) delete filtered[key]
    }
    schema.properties = filtered
  }

  // Remove _-prefixed entries from required array
  if (Array.isArray(schema.required)) {
    schema.required = (schema.required as string[]).filter((r: string) => !r.startsWith('_'))
  }

  return {
    name: tool.name,
    description: tool.description,
    input_schema: schema,
  }
}

/**
 * Convert persisted AgentMessage history into the Anthropic messages format.
 * Skips tool-role messages (they are inlined as tool_result blocks).
 */
function historyToAnthropicMessages(
  history: AgentMessage[]
): AnthropicMessage[] {
  const messages: AnthropicMessage[] = []

  for (const msg of history) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'assistant') {
      const contentBlocks: AnthropicContentBlock[] = [
        { type: 'text', text: msg.content },
      ]
      messages.push({ role: 'assistant', content: contentBlocks })
    }
    // tool messages are already captured as part of the assistant/user
    // tool_use / tool_result flow and don't need separate entries
  }

  return messages
}

/**
 * Format retrieved memories into a context section for injection into the system prompt.
 */
function buildMemoryContext(memories: AgentMemory[]): string {
  const scopeLabels: Record<string, string> = {
    customer: '(Customer)',
    business: '(Business)',
    agent: '(Agent)',
    conversation: '(Conversation)',
  }
  const lines = ['## Relevant Memories', '']
  for (const mem of memories) {
    const scope = scopeLabels[mem.scope] ?? '(Unknown)'
    lines.push(`- ${scope} [${mem.category}] ${mem.content}`)
  }
  lines.push('')
  lines.push(
    'Use these memories to provide personalized, context-aware responses. If you learn something new worth remembering, use the store_memory tool.'
  )
  return lines.join('\n')
}

/**
 * Format pending handoffs into a context section for injection into the system prompt.
 */
function buildHandoffContext(handoffs: AgentHandoff[]): string {
  const lines = ['## Agent Handoffs', '']
  for (const h of handoffs) {
    lines.push('**Handoff from another agent:**')
    lines.push(h.summary)
    lines.push('')
  }
  return lines.join('\n')
}

/**
 * Build the master context string from site_config fields.
 */
function buildMasterContext(config: Record<string, unknown>): string {
  const lines: string[] = [
    '## Business Context',
    '',
  ]

  if (config.site_name) lines.push(`**Business Name:** ${config.site_name}`)
  if (config.tagline) lines.push(`**Tagline:** ${config.tagline}`)
  if (config.seo_description) lines.push(`**Description:** ${config.seo_description}`)
  if (config.industry) lines.push(`**Industry:** ${config.industry}`)
  if (config.target_audience) lines.push(`**Target Audience:** ${config.target_audience}`)
  if (config.brand_voice) lines.push(`**Brand Voice:** ${config.brand_voice}`)
  if (config.value_proposition) lines.push(`**Value Proposition:** ${config.value_proposition}`)
  if (config.social_links) {
    lines.push(`**Social Links:** ${JSON.stringify(config.social_links)}`)
  }

  lines.push('')
  lines.push(
    'Use this context to maintain consistent branding, voice, and messaging across all interactions.'
  )

  return lines.join('\n')
}
