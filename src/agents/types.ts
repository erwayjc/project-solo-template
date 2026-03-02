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
