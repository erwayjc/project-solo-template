// ---------------------------------------------------------------------------
// MCP Type Definitions
// ---------------------------------------------------------------------------

/**
 * Describes a single tool that can be invoked by the agent system.
 * The inputSchema follows JSON Schema (compatible with Claude tool_use).
 */
export interface ToolDefinition {
  /** Unique tool name in snake_case, e.g. "create_blog_post" */
  name: string

  /** Human-readable description shown to the LLM */
  description: string

  /** JSON Schema object describing the expected input parameters */
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
    [key: string]: unknown
  }

  /** The function that actually executes the tool */
  execute: (params: Record<string, unknown>) => Promise<ToolResult>

  /**
   * Optional: which MCP server slug this tool belongs to.
   * Internal tools use the slug "internal".
   */
  server?: string
}

/**
 * Standardised result envelope returned by every tool execution.
 */
export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Configuration for connecting to an MCP server (internal or external).
 */
export interface McpServerConfig {
  /** URL-safe unique identifier, e.g. "stripe-mcp" */
  slug: string

  /** Human-readable name shown in the UI */
  name: string

  /** Transport mechanism */
  transport: 'streamable_http' | 'in_process'

  /** Endpoint URL for streamable_http transport */
  url?: string

  /** How the server authenticates */
  authType: 'api_key' | 'oauth' | 'none'

  /** Whether this is a built-in system server (cannot be removed) */
  isSystem: boolean
}

/**
 * Runtime state for a connected external MCP server.
 */
export interface McpConnection {
  config: McpServerConfig
  /** The MCP SDK client instance — typed as `unknown` to decouple from SDK internals */
  client: unknown
  /** Tools that were discovered after connecting */
  tools: ToolDefinition[]
  /** Connection status */
  status: 'connected' | 'disconnected' | 'error'
  /** Last error message, if any */
  lastError?: string
}
