// ---------------------------------------------------------------------------
// Media Library Tools
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // list_media
  // -----------------------------------------------------------------------
  {
    name: 'list_media',
    description:
      'List media files from the media library. Optionally filter by context (e.g. "media", "downloads", "avatars") and limit the number of results.',
    inputSchema: {
      type: 'object',
      properties: {
        context: {
          type: 'string',
          description: 'Filter by storage context.',
        },
        limit: {
          type: 'number',
          description: 'Max records to return (default 50).',
        },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()
      const limit = (params.limit as number) ?? 50

      let query = supabase
        .from('media')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (params.context) {
        query = query.eq('context', params.context as string)
      }

      const { data, error } = await query

      if (error) return { success: false, error: error.message }
      return { success: true, data: { media: data ?? [] } }
    },
  },

  // -----------------------------------------------------------------------
  // delete_media
  // -----------------------------------------------------------------------
  {
    name: 'delete_media',
    description:
      'Delete a media file from both Supabase Storage and the media library records.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Media record UUID.' },
      },
      required: ['id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const id = params.id as string

      // Get the media record before deleting
      const { data: media, error: mErr } = await supabase
        .from('media')
        .select('url, filename')
        .eq('id', id)
        .single()

      if (mErr) return { success: false, error: mErr.message }

      // Attempt to delete from storage using the URL path
      const mediaUrl = media.url as string
      if (mediaUrl) {
        try {
          // Extract the storage path from the public URL
          const urlObj = new URL(mediaUrl)
          const storagePath = urlObj.pathname.split('/object/public/uploads/').pop()
          if (storagePath) {
            const { error: storageErr } = await supabase.storage
              .from('uploads')
              .remove([storagePath])

            if (storageErr) {
              console.error('[delete_media] Storage deletion error:', storageErr.message)
            }
          }
        } catch {
          // URL parsing failed — non-fatal
        }
      }

      // Delete the database record
      const { error } = await supabase.from('media').delete().eq('id', id)

      if (error) return { success: false, error: error.message }
      return {
        success: true,
        data: { deleted: id, filename: media.filename },
      }
    },
  },
]
