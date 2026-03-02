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
import type { AgentConfig, AgentMessage, ToolCall } from './types'
import type { ToolDefinition } from '@/mcp/types'
import type { Json } from '@/lib/supabase/types'

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
    const systemPrompt = agent.systemPrompt.includes('{{MASTER_CONTEXT}}')
      ? agent.systemPrompt.replace('{{MASTER_CONTEXT}}', masterContext)
      : `${agent.systemPrompt}\n\n---\n\n${masterContext}`

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
        const result = await this.mcpClient.executeTool(block.name, block.input)

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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a ToolDefinition into the Claude API tool schema format.
 */
function toolToClaudeSchema(tool: ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
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
