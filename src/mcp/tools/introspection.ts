// ---------------------------------------------------------------------------
// Database Introspection Tools — schema discovery + ad-hoc read queries
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // describe_schema
  // -----------------------------------------------------------------------
  {
    name: 'describe_schema',
    description:
      'Discover the database schema. Call with no arguments to list all tables, or pass a table_name to get detailed column information (name, type, nullable, default, comments). Use this to understand what data exists before making assumptions about capabilities.',
    inputSchema: {
      type: 'object',
      properties: {
        table_name: {
          type: 'string',
          description:
            'Optional table name to inspect. If omitted, returns a list of all tables with column counts.',
        },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()

      const { data, error } = await supabase.rpc('describe_schema', {
        p_table_name: (params.table_name as string) || null,
      })

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // query_database
  // -----------------------------------------------------------------------
  {
    name: 'query_database',
    description:
      'Run a read-only SQL query against the database and return results as JSON. Only SELECT and WITH (CTE) queries are allowed — no inserts, updates, deletes, or DDL. Use this to answer ad-hoc questions, check data state, or investigate issues that existing tools don\'t cover. Max 100 rows by default.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'A read-only SQL query (SELECT or WITH). Example: "SELECT * FROM site_config WHERE id = 1"',
        },
        max_rows: {
          type: 'number',
          description: 'Maximum rows to return. Defaults to 100.',
        },
      },
      required: ['query'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      const { data, error } = await supabase.rpc('execute_readonly_query', {
        p_query: params.query as string,
        p_max_rows: (params.max_rows as number) || 100,
      })

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },
]
