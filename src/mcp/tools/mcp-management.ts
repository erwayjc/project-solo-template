// ---------------------------------------------------------------------------
// MCP Connection Management Tools
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // list_mcp_connections
  // -----------------------------------------------------------------------
  {
    name: 'list_mcp_connections',
    description:
      'List all configured MCP server connections, including their status and capabilities.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute() {
      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('mcp_connections')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name', { ascending: true })

      if (error) return { success: false, error: error.message }
      return { success: true, data: { connections: data ?? [] } }
    },
  },

  // -----------------------------------------------------------------------
  // add_mcp_connection
  // -----------------------------------------------------------------------
  {
    name: 'add_mcp_connection',
    description:
      'Register a new external MCP server connection. The connection is saved but not automatically activated. Use test_mcp_connection to verify it works.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Human-readable server name.' },
        slug: {
          type: 'string',
          description: 'Unique URL-safe identifier (lowercase, hyphens).',
        },
        transport: {
          type: 'string',
          enum: ['streamable_http', 'in_process'],
          description: 'Transport protocol.',
        },
        url: {
          type: 'string',
          description: 'Server endpoint URL (required for streamable_http).',
        },
        auth_type: {
          type: 'string',
          enum: ['api_key', 'oauth', 'none'],
          description: 'Authentication method.',
        },
        credentials: {
          type: 'object',
          description:
            'Authentication credentials (stored encrypted). Shape depends on auth_type.',
        },
      },
      required: ['name', 'slug', 'transport', 'auth_type'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      // Check slug uniqueness
      const { data: existing } = await supabase
        .from('mcp_connections')
        .select('id')
        .eq('slug', params.slug as string)
        .single()

      if (existing) {
        return { success: false, error: `MCP connection slug "${params.slug}" already exists.` }
      }

      // Validate URL for streamable_http
      if (params.transport === 'streamable_http' && !params.url) {
        return { success: false, error: 'URL is required for streamable_http transport.' }
      }

      const { data, error } = await supabase
        .from('mcp_connections')
        .insert({
          name: params.name as string,
          slug: params.slug as string,
          transport: (params.transport as string) ?? 'in_process',
          url: (params.url as string) ?? null,
          auth_type: (params.auth_type as string) ?? 'none',
          credentials_encrypted: params.credentials ? JSON.stringify(params.credentials) : null,
          is_system: false,
          is_active: false,
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }

      // Omit credentials from the response
      const safeData = { ...(data as Record<string, unknown>) }
      delete safeData.credentials_encrypted
      return { success: true, data: safeData }
    },
  },

  // -----------------------------------------------------------------------
  // test_mcp_connection
  // -----------------------------------------------------------------------
  {
    name: 'test_mcp_connection',
    description:
      'Test an MCP server connection by attempting to connect and list its available tools. Updates the connection status in the database.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'MCP connection slug to test.' },
      },
      required: ['slug'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const slug = params.slug as string

      // Load connection config
      const { data: conn, error: cErr } = await supabase
        .from('mcp_connections')
        .select('*')
        .eq('slug', slug)
        .single()

      if (cErr) return { success: false, error: cErr.message }

      if (conn.transport !== 'streamable_http') {
        // In-process connections are always "available"
        await supabase
          .from('mcp_connections')
          .update({ is_active: true })
          .eq('slug', slug)

        return {
          success: true,
          data: { status: 'connected', transport: conn.transport, tools: [] },
        }
      }

      if (!conn.url) {
        return { success: false, error: 'No URL configured for this connection.' }
      }

      try {
        const transport = new StreamableHTTPClientTransport(
          new URL(conn.url as string)
        )

        const client = new Client({
          name: 'project-solo-test',
          version: '1.0.0',
        })

        await client.connect(transport)

        // List tools to verify the connection
        const toolList = await client.listTools()
        const toolNames = (toolList.tools ?? []).map((t) => t.name)

        // Disconnect after test
        await client.close()

        // Update status in DB
        await supabase
          .from('mcp_connections')
          .update({
            is_active: true,
          })
          .eq('slug', slug)

        return {
          success: true,
          data: {
            status: 'connected',
            url: conn.url,
            toolsDiscovered: toolNames.length,
            tools: toolNames,
          },
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Connection test failed'

        // Update status in DB
        await supabase
          .from('mcp_connections')
          .update({
            is_active: false,
          })
          .eq('slug', slug)

        return {
          success: false,
          error: `Connection test failed: ${errorMessage}`,
        }
      }
    },
  },

  // -----------------------------------------------------------------------
  // remove_mcp_connection
  // -----------------------------------------------------------------------
  {
    name: 'remove_mcp_connection',
    description:
      'Remove an MCP server connection. System connections cannot be removed.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'MCP connection slug to remove.' },
      },
      required: ['slug'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const slug = params.slug as string

      // Check if system connection
      const { data: conn, error: cErr } = await supabase
        .from('mcp_connections')
        .select('id, name, is_system')
        .eq('slug', slug)
        .single()

      if (cErr) return { success: false, error: cErr.message }

      if (conn.is_system) {
        return {
          success: false,
          error: `Cannot remove system connection "${conn.name}". System connections are protected.`,
        }
      }

      const { error } = await supabase.from('mcp_connections').delete().eq('slug', slug)

      if (error) return { success: false, error: error.message }
      return { success: true, data: { removed: slug, name: conn.name } }
    },
  },
]
