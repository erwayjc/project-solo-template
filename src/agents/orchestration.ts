// ---------------------------------------------------------------------------
// Orchestration — delegation tool factory and constants for agent orchestration
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition, ToolResult } from '@/mcp/types'
import type { AgentEngine } from './engine'
import type { AgentProgressEvent, DelegationRecord, DelegationState } from './types'

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
  turnStartTime: number,
  onProgress?: (event: AgentProgressEvent) => void
): ToolDefinition {
  const state: DelegationState = {
    records: [],
    maxDelegations: MAX_DELEGATIONS_PER_TURN,
    timeBudgetRemainingMs: DELEGATION_TIMEOUT_MS,
    totalTokensUsed: 0,
  }

  const emit = onProgress ?? (() => {})

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

      // Enforce per-turn delegation cap
      if (state.records.filter((r) => r.status !== 'failed').length >= MAX_DELEGATIONS_PER_TURN) {
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
        model: (agentRow.model as string) ?? 'claude-sonnet-4-20250514',
        isSystem: agentRow.is_system as boolean,
      }

      // Compute remaining time budget
      const elapsed = Date.now() - turnStartTime
      const timeBudgetMs = DELEGATION_TIMEOUT_MS - elapsed
      state.timeBudgetRemainingMs = timeBudgetMs

      // Create delegation record
      const record: DelegationRecord = {
        specialist: agentSlug,
        specialistName: specialistConfig.name,
        status: 'in-progress',
        startedAt: new Date().toISOString(),
        completedAt: null,
        roundsUsed: 0,
        toolsUsed: [],
        tokensUsed: 0,
        responseSummary: '',
      }
      state.records.push(record)

      emit({ type: 'delegation_start', specialist: agentSlug, specialistName: specialistConfig.name })

      try {
        const result = await engine.delegate(
          specialistConfig,
          message,
          masterContext,
          conversationId,
          timeBudgetMs
        )

        // Update record on success
        record.status = 'completed'
        record.completedAt = new Date().toISOString()
        record.roundsUsed = result.roundsUsed
        record.toolsUsed = result.toolCalls
        record.tokensUsed = result.tokensUsed
        record.responseSummary = result.response.slice(0, 500)
        state.totalTokensUsed += result.tokensUsed

        emit({ type: 'delegation_end', specialist: agentSlug, status: 'completed', roundsUsed: result.roundsUsed })

        return {
          success: true,
          data: result,
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Delegation failed unexpectedly'

        // Update record on failure
        record.status = 'failed'
        record.completedAt = new Date().toISOString()
        record.error = errorMessage

        emit({ type: 'delegation_end', specialist: agentSlug, status: 'failed', roundsUsed: 0 })

        return {
          success: false,
          error: errorMessage,
        }
      }
    },

    // Expose delegation state for the status tool
    _delegationState: state,
  } as ToolDefinition & { _delegationState: DelegationState }
}

/**
 * Create the delegation_status tool that reports current delegation state.
 */
export function createDelegationStatusTool(
  getDelegationState: () => DelegationState | undefined,
  turnStartTime: number
): ToolDefinition {
  return {
    name: 'delegation_status',
    description:
      'Check the current status of delegations in this turn. Returns how many delegations have been used, their results, time budget remaining, and token usage.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute(): Promise<ToolResult> {
      const state = getDelegationState()
      if (!state) {
        return {
          success: true,
          data: {
            delegations_used: 0,
            delegations_remaining: MAX_DELEGATIONS_PER_TURN,
            records: [],
            time_budget_remaining_ms: DELEGATION_TIMEOUT_MS - (Date.now() - turnStartTime),
            total_tokens_used: 0,
          },
        }
      }

      const completedCount = state.records.filter((r) => r.status === 'completed').length
      return {
        success: true,
        data: {
          delegations_used: completedCount,
          delegations_remaining: MAX_DELEGATIONS_PER_TURN - completedCount,
          records: state.records.map((r) => ({
            specialist: r.specialist,
            specialistName: r.specialistName,
            status: r.status,
            roundsUsed: r.roundsUsed,
            toolsUsed: r.toolsUsed,
            tokensUsed: r.tokensUsed,
            error: r.error,
          })),
          time_budget_remaining_ms: DELEGATION_TIMEOUT_MS - (Date.now() - turnStartTime),
          total_tokens_used: state.totalTokensUsed,
        },
      }
    },
  }
}
