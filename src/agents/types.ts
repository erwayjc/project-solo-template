// ---------------------------------------------------------------------------
// Agent System Type Definitions
// ---------------------------------------------------------------------------

/**
 * Configuration for an agent, as stored in the database.
 */
export interface AgentConfig {
  /** Database UUID */
  id: string

  /** Display name, e.g. "Dev Agent" */
  name: string

  /** URL-safe identifier, e.g. "dev-agent" */
  slug: string

  /** Full system prompt that defines the agent behavior */
  systemPrompt: string

  /** Tool names this agent is allowed to invoke */
  tools: string[]

  /** MCP server slugs this agent may access */
  mcpServers: string[]

  /**
   * Data access permissions.
   * Keys are table names, values are permission levels.
   */
  dataAccess: Record<string, 'read' | 'write' | 'none'>

  /** Anthropic model ID to use for this agent (e.g. 'claude-sonnet-4-20250514') */
  model: string

  /** Whether this is a built-in system agent (cannot be deleted) */
  isSystem: boolean
}

/**
 * A single message within an agent conversation.
 */
export interface AgentMessage {
  /** Message author */
  role: 'user' | 'assistant' | 'tool'

  /** Text content of the message */
  content: string

  /** Tool invocations made by the assistant in this turn */
  toolCalls?: ToolCall[]

  /** ISO 8601 timestamp */
  timestamp: string
}

/**
 * Represents a single tool invocation within a conversation turn.
 */
export interface ToolCall {
  /** Unique ID for this tool call (matches Claude's tool_use block id) */
  id: string

  /** Tool name that was invoked */
  name: string

  /** Input parameters passed to the tool */
  input: Record<string, unknown>

  /** Result returned by the tool (populated after execution) */
  result?: unknown
}

/**
 * Memory visibility scope.
 */
export type MemoryScope = 'customer' | 'business' | 'agent' | 'conversation'

/**
 * A persistent memory created by an agent.
 */
export interface AgentMemory {
  id: string
  agent_id: string
  scope: MemoryScope
  customer_id: string | null
  content: string
  category: string
  importance: number
  source_conversation_id: string | null
  metadata: Record<string, unknown>
  similarity?: number // populated by match_memories RPC
  created_at: string
  updated_at: string
}

/**
 * An inter-agent context transfer record.
 */
export interface AgentHandoff {
  id: string
  source_agent_id: string
  target_agent_id: string
  customer_id: string | null
  summary: string
  memory_ids: string[]
  status: 'pending' | 'accepted' | 'completed' | 'expired'
  metadata: Record<string, unknown>
  created_at: string
  expires_at: string | null
}

/**
 * Context passed into the agent engine for a conversation turn.
 */
export interface ConversationContext {
  /** Existing conversation ID to continue, or undefined to start a new one */
  conversationId?: string

  /** The agent that will handle this conversation */
  agentId: string

  /** Message history (loaded from DB or built up during the turn) */
  messages: AgentMessage[]
}

/**
 * Progress events emitted by the engine during a conversation turn.
 * Used to provide real-time feedback in the chat UI.
 */
export type AgentProgressEvent =
  | { type: 'status'; message: string }
  | { type: 'tool_start'; toolName: string; toolCallId: string }
  | { type: 'tool_end'; toolName: string; toolCallId: string }
  | { type: 'delegation_start'; specialist: string; specialistName: string }
  | { type: 'delegation_end'; specialist: string; status: 'completed' | 'failed'; roundsUsed: number }
  | { type: 'text'; content: string }
  | { type: 'done'; conversationId: string; toolCalls: ToolCall[]; tokensUsed: number; delegations?: DelegationRecord[] }

/**
 * Record of a single delegation to a specialist agent.
 */
export interface DelegationRecord {
  /** Specialist agent slug */
  specialist: string
  /** Specialist display name */
  specialistName: string
  /** Current status */
  status: 'in-progress' | 'completed' | 'failed'
  /** When the delegation started */
  startedAt: string
  /** When it completed (null if in-progress) */
  completedAt: string | null
  /** Number of tool-use rounds the specialist used */
  roundsUsed: number
  /** Tool names the specialist invoked */
  toolsUsed: string[]
  /** Token count used by this delegation */
  tokensUsed: number
  /** Truncated summary of the specialist's response */
  responseSummary: string
  /** Error message if failed */
  error?: string
}

/**
 * Aggregated state of all delegations within a single orchestrator turn.
 */
export interface DelegationState {
  /** Delegation records for this turn */
  records: DelegationRecord[]
  /** Max delegations allowed per turn */
  maxDelegations: number
  /** Wall-clock time budget remaining (ms) */
  timeBudgetRemainingMs: number
  /** Total tokens used across all delegations */
  totalTokensUsed: number
}
