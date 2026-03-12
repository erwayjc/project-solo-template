// ---------------------------------------------------------------------------
// Custom Pages Tools — CRUD + analytics for bespoke HTML/CSS/JS pages
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizePageHtml } from '@/lib/utils/sanitize'
import { customPageSlugSchema } from '@/lib/utils/validation'
import type { Json } from '@/lib/supabase/types'
import type { ToolDefinition } from '../types'

const MAX_HTML_SIZE = 256 * 1024 // 256KB

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // create_custom_page
  // -----------------------------------------------------------------------
  {
    name: 'create_custom_page',
    description:
      'Create a new custom HTML/CSS/JS page from scratch. Pages default to draft (unpublished). Returns a preview URL for the user to review before publishing.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description:
            'URL slug for the page (lowercase, hyphens only). e.g. "spring-sale", "free-guide"',
        },
        html_content: {
          type: 'string',
          description:
            'Full HTML content for the page body — include <style> blocks for CSS and inline <script> for JS. No external scripts allowed.',
        },
        seo: {
          type: 'object',
          description: 'SEO metadata for the page',
          properties: {
            title: { type: 'string', description: 'Page title (shown in browser tab and search results)' },
            description: { type: 'string', description: 'Meta description for search engines' },
            og_image: { type: 'string', description: 'Open Graph image URL for social sharing' },
            keywords: { type: 'string', description: 'Comma-separated keywords' },
          },
        },
        is_published: {
          type: 'boolean',
          description: 'Whether to publish immediately (default: false — draft)',
        },
      },
      required: ['slug', 'html_content'],
    },
    async execute(params) {
      const slug = params.slug as string
      const htmlContent = params.html_content as string
      const seo = params.seo as Record<string, string> | undefined
      const isPublished = (params.is_published as boolean) ?? false

      // F10: Use centralized slug validation
      const slugResult = customPageSlugSchema.safeParse(slug)
      if (!slugResult.success) {
        return { success: false, error: slugResult.error.issues[0]?.message || 'Invalid slug format' }
      }

      // Validate content size
      if (Buffer.byteLength(htmlContent, 'utf-8') > MAX_HTML_SIZE) {
        return { success: false, error: `HTML content exceeds maximum size of 256KB` }
      }

      const supabase = createAdminClient()

      // Check for duplicate slug
      const { data: existing } = await supabase
        .from('pages')
        .select('id')
        .eq('slug', slug)
        .single()

      if (existing) {
        return { success: false, error: `A page with slug "${slug}" already exists. Choose a different slug.` }
      }

      // Sanitize HTML
      const sanitizedHtml = sanitizePageHtml(htmlContent)

      // Insert page
      const { data, error } = await supabase
        .from('pages')
        .insert({
          slug,
          render_mode: 'custom',
          html_content: sanitizedHtml,
          seo: (seo ?? {}) as unknown as Json,
          is_published: isPublished,
          sanitized_at: new Date().toISOString(),
          sections: [] as unknown as Json,
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return {
        success: true,
        data: {
          ...data,
          preview_url: `/p/${slug}?preview=true`,
          public_url: `/p/${slug}`,
        },
      }
    },
  },

  // -----------------------------------------------------------------------
  // update_custom_page
  // -----------------------------------------------------------------------
  {
    name: 'update_custom_page',
    description:
      'Update an existing custom page. Automatically saves the previous HTML for one-level undo. Pass only the fields you want to change.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'The page slug to update',
        },
        html_content: {
          type: 'string',
          description: 'New HTML content for the page body',
        },
        seo: {
          type: 'object',
          description: 'Updated SEO metadata',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            og_image: { type: 'string' },
            keywords: { type: 'string' },
          },
        },
        is_published: {
          type: 'boolean',
          description: 'Set to true to publish, false to unpublish',
        },
      },
      required: ['slug'],
    },
    async execute(params) {
      const slug = params.slug as string
      const htmlContent = params.html_content as string | undefined
      const seo = params.seo as Record<string, string> | undefined
      const isPublished = params.is_published as boolean | undefined

      const supabase = createAdminClient()

      // Find the page
      const { data: page, error: findError } = await supabase
        .from('pages')
        .select('*')
        .eq('slug', slug)
        .eq('render_mode', 'custom')
        .single()

      if (findError || !page) {
        return { success: false, error: `Custom page "${slug}" not found` }
      }

      // Build update object
      const updates: Record<string, unknown> = {}

      if (htmlContent !== undefined) {
        if (Buffer.byteLength(htmlContent, 'utf-8') > MAX_HTML_SIZE) {
          return { success: false, error: `HTML content exceeds maximum size of 256KB` }
        }

        // One-level undo: save current content before overwriting
        updates.html_content_previous = page.html_content
        updates.html_content = sanitizePageHtml(htmlContent)
        updates.sanitized_at = new Date().toISOString()
      }

      if (seo !== undefined) {
        updates.seo = seo as unknown as Json
      }

      if (isPublished !== undefined) {
        updates.is_published = isPublished
      }

      if (Object.keys(updates).length === 0) {
        return { success: false, error: 'No fields to update' }
      }

      const { data, error } = await supabase
        .from('pages')
        .update(updates)
        .eq('id', page.id)
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return {
        success: true,
        data: {
          ...data,
          preview_url: `/p/${slug}?preview=true`,
          public_url: `/p/${slug}`,
        },
      }
    },
  },

  // -----------------------------------------------------------------------
  // get_custom_page
  // -----------------------------------------------------------------------
  {
    name: 'get_custom_page',
    description:
      'Get full details of a custom page including HTML content, SEO data, publish status, and view count.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'The page slug to retrieve',
        },
      },
      required: ['slug'],
    },
    async execute(params) {
      const slug = params.slug as string
      const supabase = createAdminClient()

      const { data: page, error } = await supabase
        .from('pages')
        .select('*')
        .eq('slug', slug)
        .eq('render_mode', 'custom')
        .single()

      if (error || !page) {
        return { success: false, error: `Custom page "${slug}" not found` }
      }

      return {
        success: true,
        data: {
          ...page,
          preview_url: `/p/${slug}?preview=true`,
          public_url: `/p/${slug}`,
        },
      }
    },
  },

  // -----------------------------------------------------------------------
  // list_custom_pages
  // -----------------------------------------------------------------------
  {
    name: 'list_custom_pages',
    description:
      'List all custom pages with slug, title, publish status, and view count. Does not return HTML content (use get_custom_page for that).',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['published', 'draft', 'all'],
          description: 'Filter by publish status (default: all)',
        },
        limit: {
          type: 'number',
          description: 'Max pages to return (default: 50)',
        },
        offset: {
          type: 'number',
          description: 'Offset for pagination (default: 0)',
        },
      },
    },
    async execute(params) {
      const status = (params.status as string) ?? 'all'
      const limit = (params.limit as number) ?? 50
      const offset = (params.offset as number) ?? 0

      const supabase = createAdminClient()

      let query = supabase
        .from('pages')
        .select('slug, seo, is_published, view_count, created_at')
        .eq('render_mode', 'custom')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (status === 'published') {
        query = query.eq('is_published', true)
      } else if (status === 'draft') {
        query = query.eq('is_published', false)
      }

      const { data, error } = await query

      if (error) {
        return { success: false, error: error.message }
      }

      return {
        success: true,
        data: (data ?? []).map((p) => ({
          slug: p.slug,
          title: (p.seo as Record<string, string> | null)?.title ?? p.slug,
          is_published: p.is_published,
          view_count: p.view_count,
          created_at: p.created_at,
          preview_url: `/p/${p.slug}?preview=true`,
          public_url: `/p/${p.slug}`,
        })),
      }
    },
  },

  // -----------------------------------------------------------------------
  // get_page_stats
  // -----------------------------------------------------------------------
  {
    name: 'get_page_stats',
    description:
      'Get performance stats for a custom page: view count, lead captures, and conversion rate.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'The page slug to get stats for',
        },
      },
      required: ['slug'],
    },
    async execute(params) {
      const slug = params.slug as string
      const supabase = createAdminClient()

      // Get page view count
      const { data: page, error: pageError } = await supabase
        .from('pages')
        .select('view_count, is_published, created_at')
        .eq('slug', slug)
        .eq('render_mode', 'custom')
        .single()

      if (pageError || !page) {
        return { success: false, error: `Custom page "${slug}" not found` }
      }

      // Count leads attributed to this page
      const { count: leadCount } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .or(`source.eq.${slug},metadata->>page_slug.eq.${slug}`)

      const views = page.view_count as number ?? 0
      const leads = leadCount ?? 0
      const conversionRate = views > 0 ? Math.round((leads / views) * 10000) / 100 : 0

      return {
        success: true,
        data: {
          slug,
          view_count: views,
          lead_count: leads,
          conversion_rate: conversionRate,
          is_published: page.is_published,
          created_at: page.created_at,
        },
      }
    },
  },
]
