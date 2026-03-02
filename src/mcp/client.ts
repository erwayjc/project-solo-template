// ---------------------------------------------------------------------------
// MCP Client — connects to servers, aggregates tools, routes tool calls
// ---------------------------------------------------------------------------

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type {
  ToolDefinition,
  ToolResult,
  McpServerConfig,
  McpConnection,
} from './types'
import { getAllTools, getToolByName } from './tools/index'

export class McpClient {
  /** Internal tools loaded from ./tools */
  private internalTools: ToolDefinition[] = []

  /** Active connections to external MCP servers keyed by slug */
  private connections: Map<string, McpConnection> = new Map()

  // -----------------------------------------------------------------------
  // Initialisation
  // -----------------------------------------------------------------------

  constructor() {
    // Tools are loaded lazily via loadInternalTools()
  }

  /**
   * Import all built-in tool definitions from the tools directory.
   * Should be called once at startup.
   */
  async loadInternalTools(): Promise<void> {
    this.internalTools = getAllTools().map((tool) => ({
      ...tool,
      server: 'internal',
    }))
  }

  // -----------------------------------------------------------------------
  // External MCP Server Connections
  // -----------------------------------------------------------------------

  /**
   * Connect to an external MCP server and discover its tools.
   */
  async connectExternalServer(config: McpServerConfig): Promise<void> {
    // Don't reconnect if already connected
    if (this.connections.has(config.slug)) {
      const existing = this.connections.get(config.slug)!
      if (existing.status === 'connected') return
    }

    const connection: McpConnection = {
      config,
      client: null,
      tools: [],
      status: 'disconnected',
    }

    try {
      if (config.transport === 'streamable_http') {
        if (!config.url) {
          throw new Error(
            `MCP server "${config.slug}" uses streamable_http but no URL was provided`
          )
        }

        const transport = new StreamableHTTPClientTransport(
          new URL(config.url)
        )

        const client = new Client({
          name: 'project-solo',
          version: '1.0.0',
        })

        await client.connect(transport)

        // Discover tools from the remote server
        const toolList = await client.listTools()
        const remoteTools: ToolDefinition[] = (toolList.tools ?? []).map(
          (remoteTool) => ({
            name: `${config.slug}__${remoteTool.name}`,
            description: remoteTool.description ?? '',
            inputSchema: (remoteTool.inputSchema as ToolDefinition['inputSchema']) ?? {
              type: 'object' as const,
              properties: {},
            },
            server: config.slug,
            execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
              try {
                const result = await client.callTool({
                  name: remoteTool.name,
                  arguments: params,
                })
                return {
                  success: true,
                  data: result.content,
                }
              } catch (err) {
                return {
                  success: false,
                  error:
                    err instanceof Error
                      ? err.message
                      : 'External tool call failed',
                }
              }
            },
          })
        )

        connection.client = client
        connection.tools = remoteTools
        connection.status = 'connected'
      } else if (config.transport === 'in_process') {
        // In-process servers are handled internally — nothing to connect to.
        connection.status = 'connected'
      }
    } catch (err) {
      connection.status = 'error'
      connection.lastError =
        err instanceof Error ? err.message : 'Unknown connection error'
      console.error(
        `[McpClient] Failed to connect to "${config.slug}":`,
        connection.lastError
      )
    }

    this.connections.set(config.slug, connection)
  }

  // -----------------------------------------------------------------------
  // Tool Discovery
  // -----------------------------------------------------------------------

  /**
   * Return all available tools, optionally filtered by allowed server slugs
   * and/or specific tool names.
   */
  getAvailableTools(
    allowedServers?: string[],
    allowedTools?: string[]
  ): ToolDefinition[] {
    let tools: ToolDefinition[] = [...this.internalTools]

    // Add tools from connected external servers
    for (const conn of this.connections.values()) {
      if (conn.status === 'connected') {
        tools = tools.concat(conn.tools)
      }
    }

    // Filter by server slug
    if (allowedServers && allowedServers.length > 0) {
      tools = tools.filter(
        (t) => t.server && allowedServers.includes(t.server)
      )
    }

    // Filter by tool name
    if (allowedTools && allowedTools.length > 0) {
      tools = tools.filter((t) => allowedTools.includes(t.name))
    }

    return tools
  }

  // -----------------------------------------------------------------------
  // Tool Execution
  // -----------------------------------------------------------------------

  /**
   * Route a tool call to the correct handler — internal or external.
   */
  async executeTool(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<ToolResult> {
    // 1. Check internal tools first
    const internalTool =
      this.internalTools.find((t) => t.name === toolName) ??
      getToolByName(toolName)

    if (internalTool) {
      try {
        return await internalTool.execute(params)
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : `Internal tool "${toolName}" threw an unexpected error`,
        }
      }
    }

    // 2. Check external server tools (prefixed with slug__)
    for (const conn of this.connections.values()) {
      const externalTool = conn.tools.find((t) => t.name === toolName)
      if (externalTool) {
        try {
          return await externalTool.execute(params)
        } catch (err) {
          return {
            success: false,
            error:
              err instanceof Error
                ? err.message
                : `External tool "${toolName}" threw an unexpected error`,
          }
        }
      }
    }

    return {
      success: false,
      error: `Tool "${toolName}" not found in any registered server`,
    }
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  /**
   * Gracefully close all external MCP connections.
   */
  async disconnect(): Promise<void> {
    for (const [slug, conn] of this.connections.entries()) {
      try {
        if (conn.client && typeof (conn.client as Client).close === 'function') {
          await (conn.client as Client).close()
        }
      } catch (err) {
        console.error(`[McpClient] Error disconnecting "${slug}":`, err)
      }
      conn.status = 'disconnected'
    }
    this.connections.clear()
  }
}
