// ---------------------------------------------------------------------------
// Announcement Tools
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // create_announcement
  // -----------------------------------------------------------------------
  {
    name: 'create_announcement',
    description:
      'Create a site-wide announcement banner or notification. Announcements can be informational, warnings, or promotions with optional expiry.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Announcement headline.' },
        content: {
          type: 'string',
          description: 'Full announcement text (supports Markdown).',
        },
        type: {
          type: 'string',
          enum: ['info', 'warning', 'success', 'promotion'],
          description: 'Announcement type (default "info").',
        },
        expires_at: {
          type: 'string',
          description: 'ISO 8601 timestamp when the announcement should auto-expire.',
        },
      },
      required: ['title', 'content'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('announcements')
        .insert({
          title: params.title as string,
          content: (params.content as string) ?? '',
          type: (params.type as string) ?? 'info',
          expires_at: (params.expires_at as string) ?? null,
          is_published: true,
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // update_announcement
  // -----------------------------------------------------------------------
  {
    name: 'update_announcement',
    description:
      'Update an existing announcement. Can change content, type, expiry, or toggle active status.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Announcement UUID.' },
        updates: {
          type: 'object',
          description: 'Fields to update.',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            type: { type: 'string', enum: ['info', 'warning', 'success', 'promotion'] },
            expires_at: { type: 'string' },
            is_published: { type: 'boolean' },
          },
        },
      },
      required: ['id', 'updates'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const id = params.id as string
      const updates = params.updates as Record<string, unknown>

      const { data, error } = await supabase
        .from('announcements')
        .update(updates as unknown as Record<string, never>)
        .eq('id', id)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },
]
