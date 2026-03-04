// ---------------------------------------------------------------------------
// Orchestration — delegation tool factory and constants for agent orchestration
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition, ToolResult } from '@/mcp/types'
import type { AgentEngine } from './engine'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tools excluded from specialist tool sets during delegation */
export const DELEGATION_BLOCKED_TOOLS = ['delegate_to_agent']

/** Agent slugs that cannot be delegation targets (customer-facing or restricted) */
export const DELEGATION_EXCLUDED_AGENTS = ['support-agent']

/** System prompt preamble prepended to specialists during delegation */
export const DELEGATION_MODE_PREAMBLE = `## Delegation Mode
You have been invoked by the Dev Agent orchestrator to assist with a specific task.
- You are NOT in a direct conversation with the user.
- Provide your response to the orchestrator, who will present it to the user.
- Operate in advisory mode: recommend actions but do NOT execute destructive operations (deletes, broadcasts, irreversible changes).
- Include your reasoning and approach so the orchestrator can explain your work to the user.`

/** Max tool loop rounds for delegated specialists */
export const MAX_DELEGATION_ROUNDS = 5

/** Wall-clock time budget default (ms) */
export const DELEGATION_TIMEOUT_MS = 45000

/** Hard cap on delegations per orchestrator turn */
export const MAX_DELEGATIONS_PER_TURN = 3

// ---------------------------------------------------------------------------
// Delegation Tool Factory
// ---------------------------------------------------------------------------

/**
 * Create the delegate_to_agent tool definition with a closure over the engine.
 * The tool is registered dynamically at runtime for orchestrator-eligible agents.
 */
export function createDelegationTool(
  engine: AgentEngine,
  masterContext: string,
  conversationId: string,
  turnStartTime: number
): ToolDefinition {
  let delegationCount = 0

  return {
    name: 'delegate_to_agent',
    description:
      'Delegate a task to a specialist agent. The specialist will process the task using their domain expertise and tools, then return the result. Use this for content creation, copywriting, strategy, and domain-specific optimization tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_slug: {
          type: 'string',
          description:
            'The slug of the specialist agent to delegate to (e.g. "email-copywriter", "content-director", "sales-strategist", "customer-success").',
        },
        message: {
          type: 'string',
          description:
            'A comprehensive briefing message for the specialist. Include the user\'s request, relevant context, and any specific instructions or constraints.',
        },
        _agent_id: {
          type: 'string',
          description: 'The calling agent ID (injected by engine).',
        },
        _conversation_id: {
          type: 'string',
          description: 'The conversation ID (injected by engine).',
        },
      },
      required: ['agent_slug', 'message', '_agent_id'],
    },
    async execute(params: Record<string, unknown>): Promise<ToolResult> {
      const agentSlug = params.agent_slug as string
      const message = params.message as string
      const callingAgentId = params._agent_id as string

      // Enforce per-turn delegation cap (check before incrementing so
      // failed validations and retries don't consume the cap)
      if (delegationCount >= MAX_DELEGATIONS_PER_TURN) {
        return {
          success: false,
          error: `Maximum delegations per turn (${MAX_DELEGATIONS_PER_TURN}) exceeded`,
        }
      }

      // Check excluded agents before DB query
      if (DELEGATION_EXCLUDED_AGENTS.includes(agentSlug)) {
        return { success: false, error: `Agent "${agentSlug}" is not available for delegation` }
      }

      // Resolve specialist by slug (must be active)
      const supabase = createAdminClient()
      const { data: agentRow, error: agentErr } = await supabase
        .from('agents')
        .select('*')
        .eq('slug', agentSlug)
        .eq('is_active', true)
        .single()

      if (agentErr || !agentRow) {
        return { success: false, error: `Agent "${agentSlug}" not found` }
      }

      // Prevent self-delegation
      if ((agentRow.id as string) === callingAgentId) {
        return { success: false, error: 'Cannot delegate to self' }
      }

      const specialistConfig = {
        id: agentRow.id as string,
        name: agentRow.name as string,
        slug: agentRow.slug as string,
        systemPrompt: agentRow.system_prompt as string,
        tools: (agentRow.tools as string[]) ?? [],
        mcpServers: (agentRow.mcp_servers as string[]) ?? ['internal'],
        dataAccess:
          (agentRow.data_access as unknown as Record<
            string,
            'read' | 'write' | 'none'
          >) ?? {},
        isSystem: agentRow.is_system as boolean,
      }

      // Compute remaining time budget
      const elapsed = Date.now() - turnStartTime
      const timeBudgetMs = DELEGATION_TIMEOUT_MS - elapsed

      try {
        const result = await engine.delegate(
          specialistConfig,
          message,
          masterContext,
          conversationId,
          timeBudgetMs
        )
        delegationCount++
        return {
          success: true,
          data: result,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Delegation failed unexpectedly',
        }
      }
    },
  }
}
