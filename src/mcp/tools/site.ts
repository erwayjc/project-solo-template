// ---------------------------------------------------------------------------
// Site Management Tools
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // update_site_config
  // -----------------------------------------------------------------------
  {
    name: 'update_site_config',
    description:
      'Update site configuration fields such as site name, tagline, colors, social links, SEO defaults, and more. Pass only the fields you want to change.',
    inputSchema: {
      type: 'object',
      properties: {
        fields: {
          type: 'object',
          description:
            'Key-value pairs to update in the site_config table. Common keys: site_name, tagline, primary_color, logo_url, favicon_url, seo_title, seo_description, social_links, footer_text.',
        },
      },
      required: ['fields'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const fields = params.fields as Record<string, unknown>

      // site_config is expected to have a single row (id = 1 or use .single())
      const { data, error } = await supabase
        .from('site_config')
        .update(fields as any)
        .eq('id', 1)
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // update_page_content
  // -----------------------------------------------------------------------
  {
    name: 'update_page_content',
    description:
      'Update the content sections on a specific page identified by its slug. Each section has a key and structured content.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'The page slug, e.g. "home", "about", "landing".',
        },
        sections: {
          type: 'array',
          description: 'Array of section objects to upsert.',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Section identifier' },
              content: {
                type: 'object',
                description: 'Structured content for the section',
              },
            },
            required: ['key', 'content'],
          },
        },
      },
      required: ['slug', 'sections'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const slug = params.slug as string
      const sections = params.sections as Array<{
        key: string
        content: Record<string, unknown>
      }>

      // Find the page by slug
      const { data: page, error: pageError } = await supabase
        .from('pages')
        .select('id, sections')
        .eq('slug', slug)
        .single()

      if (pageError) {
        return { success: false, error: `Page "${slug}" not found: ${pageError.message}` }
      }

      // Merge sections into existing content
      const existingSections = (page.sections as Record<string, unknown>) ?? {}
      for (const section of sections) {
        existingSections[section.key] = section.content
      }

      const { data, error } = await supabase
        .from('pages')
        .update({
          sections: existingSections as import('@/lib/supabase/types').Json,
        })
        .eq('id', page.id)
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // upload_file
  // -----------------------------------------------------------------------
  {
    name: 'upload_file',
    description:
      'Upload a file to Supabase Storage. Provide a filename, base64-encoded file data, and a context string that determines the storage bucket/path (e.g. "media", "downloads", "avatars").',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Desired filename including extension, e.g. "hero.png".',
        },
        base64Data: {
          type: 'string',
          description: 'Base64-encoded file content.',
        },
        context: {
          type: 'string',
          description:
            'Storage context that maps to a bucket/path. One of: "media", "downloads", "avatars", "content".',
        },
      },
      required: ['filename', 'base64Data', 'context'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const filename = params.filename as string
      const base64Data = params.base64Data as string
      const context = params.context as string

      const bucket = 'uploads'
      const path = `${context}/${Date.now()}-${filename}`

      // Decode base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64')

      // Determine content type from extension
      const ext = filename.split('.').pop()?.toLowerCase() ?? ''
      const mimeMap: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        pdf: 'application/pdf',
        mp4: 'video/mp4',
        mp3: 'audio/mpeg',
        zip: 'application/zip',
      }
      const contentType = mimeMap[ext] ?? 'application/octet-stream'

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, buffer, { contentType, upsert: false })

      if (uploadError) {
        return { success: false, error: uploadError.message }
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(path)

      // Record in media table
      const { error: mediaError } = await supabase.from('media').insert({
        filename,
        url: publicUrl,
        context,
        mime_type: contentType,
        size_bytes: buffer.length,
      })

      if (mediaError) {
        console.error('[upload_file] media record insert error:', mediaError.message)
      }

      return {
        success: true,
        data: {
          path: uploadData.path,
          publicUrl,
          contentType,
          sizeBytes: buffer.length,
        },
      }
    },
  },
]
