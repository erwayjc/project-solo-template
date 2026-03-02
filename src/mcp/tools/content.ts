// ---------------------------------------------------------------------------
// Content & Social Media Tools
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // create_blog_post
  // -----------------------------------------------------------------------
  {
    name: 'create_blog_post',
    description:
      'Create a new blog post. The post is created in the specified status (default "draft"). Supports SEO metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Post title.' },
        content: {
          type: 'string',
          description: 'Full post content in Markdown or HTML.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags/categories.',
        },
        seo: {
          type: 'object',
          description: 'Optional SEO metadata.',
          properties: {
            meta_title: { type: 'string' },
            meta_description: { type: 'string' },
            og_image: { type: 'string' },
          },
        },
        status: {
          type: 'string',
          enum: ['draft', 'published', 'archived'],
          description: 'Post status (default "draft").',
        },
      },
      required: ['title', 'content'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      // Generate slug from title
      const slug = (params.title as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      const status = (params.status as string) ?? 'draft'
      const now = new Date().toISOString()

      const { data, error } = await supabase
        .from('blog_posts')
        .insert({
          title: params.title as string,
          slug,
          content: (params.content as string) ?? '',
          tags: (params.tags as string[]) ?? [],
          seo: (params.seo ?? null) as import('@/lib/supabase/types').Json,
          status,
          published_at: status === 'published' ? now : null,
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // update_blog_post
  // -----------------------------------------------------------------------
  {
    name: 'update_blog_post',
    description: 'Update an existing blog post by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Blog post UUID.' },
        updates: {
          type: 'object',
          description: 'Fields to update.',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            seo: { type: 'object' },
            status: { type: 'string', enum: ['draft', 'published', 'archived'] },
          },
        },
      },
      required: ['id', 'updates'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const id = params.id as string
      const updates = { ...(params.updates as Record<string, unknown>) }

      // If publishing for the first time, set published_at
      if (updates.status === 'published') {
        const { data: existing } = await supabase
          .from('blog_posts')
          .select('published_at')
          .eq('id', id)
          .single()

        if (existing && !existing.published_at) {
          updates.published_at = new Date().toISOString()
        }
      }

      // Regenerate slug if title changed
      if (updates.title) {
        updates.slug = (updates.title as string)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      }

      const { data, error } = await supabase
        .from('blog_posts')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // create_social_content
  // -----------------------------------------------------------------------
  {
    name: 'create_social_content',
    description:
      'Create a social media post draft in the content queue. Supports scheduling and media attachments.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube'],
          description: 'Target social platform.',
        },
        content: {
          type: 'string',
          description: 'Post content/caption text.',
        },
        media_urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional URLs of media to attach.',
        },
        scheduled_for: {
          type: 'string',
          description: 'ISO 8601 timestamp for scheduled posting. Omit for manual posting.',
        },
      },
      required: ['platform', 'content'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('content_queue')
        .insert({
          platform: params.platform as string,
          content: params.content as string,
          media_urls: (params.media_urls as string[]) ?? [],
          scheduled_for: (params.scheduled_for as string) ?? null,
          status: 'draft',
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // approve_social_content
  // -----------------------------------------------------------------------
  {
    name: 'approve_social_content',
    description:
      'Approve a social content draft, moving it to "approved" status so it can be posted or scheduled.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Content queue item UUID.' },
      },
      required: ['id'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('content_queue')
        .update({
          status: 'approved',
        })
        .eq('id', params.id as string)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // get_content_calendar
  // -----------------------------------------------------------------------
  {
    name: 'get_content_calendar',
    description:
      'Get a unified content calendar for a date range, including blog posts, social posts, and broadcasts.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start of range (ISO 8601 date string).',
        },
        end_date: {
          type: 'string',
          description: 'End of range (ISO 8601 date string).',
        },
      },
      required: ['start_date', 'end_date'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const startDate = params.start_date as string
      const endDate = params.end_date as string

      // Fetch scheduled social content
      const { data: socialPosts } = await supabase
        .from('content_queue')
        .select('*')
        .gte('scheduled_for', startDate)
        .lte('scheduled_for', endDate)
        .order('scheduled_for', { ascending: true })

      // Fetch blog posts created/published in range
      const { data: blogPosts } = await supabase
        .from('blog_posts')
        .select('id, title, slug, status, published_at, created_at')
        .or(`published_at.gte.${startDate},created_at.gte.${startDate}`)
        .or(`published_at.lte.${endDate},created_at.lte.${endDate}`)
        .order('created_at', { ascending: true })

      // Fetch scheduled broadcasts
      const { data: broadcasts } = await supabase
        .from('broadcasts')
        .select('id, subject, status, scheduled_for, sent_at')
        .gte('scheduled_for', startDate)
        .lte('scheduled_for', endDate)
        .order('scheduled_for', { ascending: true })

      // Merge into a unified calendar
      type CalendarItem = {
        date: string
        type: 'social' | 'blog' | 'broadcast'
        id: unknown
        title: string
        status: unknown
        platform?: unknown
      }

      const items: CalendarItem[] = []

      for (const post of socialPosts ?? []) {
        items.push({
          date: post.scheduled_for as string,
          type: 'social',
          id: post.id,
          title: (post.content as string)?.substring(0, 80) ?? '',
          status: post.status,
          platform: post.platform,
        })
      }

      for (const post of blogPosts ?? []) {
        items.push({
          date: (post.published_at ?? post.created_at) as string,
          type: 'blog',
          id: post.id,
          title: post.title as string,
          status: post.status,
        })
      }

      for (const bc of broadcasts ?? []) {
        items.push({
          date: (bc.scheduled_for ?? bc.sent_at) as string,
          type: 'broadcast',
          id: bc.id,
          title: bc.subject as string,
          status: bc.status,
        })
      }

      items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      return { success: true, data: { items, startDate, endDate } }
    },
  },
]
