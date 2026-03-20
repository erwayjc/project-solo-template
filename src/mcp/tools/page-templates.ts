// ---------------------------------------------------------------------------
// Page Template Tools — Browse templates + manage page design tokens
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/types'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // list_page_templates
  // -----------------------------------------------------------------------
  {
    name: 'list_page_templates',
    description:
      'List available page templates with name, category, and description. Use this to suggest starting points to the user before building a custom page.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['landing', 'sales', 'opt-in', 'webinar', 'course-launch', 'about', 'waitlist', 'showcase'],
          description: 'Filter by template category (optional)',
        },
      },
    },
    async execute(params) {
      const category = params.category as string | undefined
      const supabase = createAdminClient()

      let query = supabase
        .from('page_templates')
        .select('id, name, category, description, design_notes')
        .eq('is_active', true)
        .order('category')

      if (category) {
        query = query.eq('category', category)
      }

      const { data, error } = await query

      if (error) {
        return { success: false, error: error.message }
      }

      return {
        success: true,
        data: data ?? [],
      }
    },
  },

  // -----------------------------------------------------------------------
  // get_page_template
  // -----------------------------------------------------------------------
  {
    name: 'get_page_template',
    description:
      'Get the full HTML content and design notes for a specific page template. Use this to fetch a template as a starting point, then customize it heavily for the user.',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: {
          type: 'string',
          description: 'The UUID of the template to retrieve',
        },
      },
      required: ['template_id'],
    },
    async execute(params) {
      const templateId = params.template_id as string
      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('page_templates')
        .select('*')
        .eq('id', templateId)
        .eq('is_active', true)
        .single()

      if (error || !data) {
        return { success: false, error: 'Template not found' }
      }

      return {
        success: true,
        data,
      }
    },
  },

  // -----------------------------------------------------------------------
  // save_page_design_tokens
  // -----------------------------------------------------------------------
  {
    name: 'save_page_design_tokens',
    description:
      'Save page design token preferences (fonts, button style, section style, overall vibe) to the site config. Call this after collaborating with the user on their first page to lock in brand identity for all future pages.',
    inputSchema: {
      type: 'object',
      properties: {
        fonts: {
          type: 'object',
          description: 'Font preferences',
          properties: {
            heading: {
              type: 'string',
              description: 'Font stack for headings, e.g. "Georgia, serif" or "system-ui, sans-serif"',
            },
            body: {
              type: 'string',
              description: 'Font stack for body text, e.g. "system-ui, -apple-system, sans-serif"',
            },
          },
        },
        button_style: {
          type: 'string',
          enum: ['rounded', 'pill', 'square'],
          description: 'Button border-radius style preference',
        },
        section_style: {
          type: 'string',
          enum: ['spacious', 'compact', 'editorial'],
          description: 'Section spacing/padding preference',
        },
        overall_vibe: {
          type: 'string',
          enum: ['modern-minimal', 'bold-vibrant', 'warm-organic', 'elegant-luxury', 'tech-forward'],
          description: 'The overall design aesthetic',
        },
        custom_css: {
          type: 'string',
          description: 'Optional custom CSS to inject into all pages (e.g. Google Fonts @import)',
        },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()

      // Get current tokens
      const { data: config, error: fetchError } = await supabase
        .from('site_config')
        .select('page_design_tokens')
        .eq('id', 1)
        .single()

      if (fetchError) {
        return { success: false, error: fetchError.message }
      }

      const currentTokens = (config?.page_design_tokens as Record<string, unknown>) ?? {}

      // Merge new values over existing
      const updated: Record<string, unknown> = { ...currentTokens }

      if (params.fonts) {
        const fonts = params.fonts as Record<string, string>
        updated.fonts = {
          ...(currentTokens.fonts as Record<string, string> | undefined),
          ...fonts,
        }
      }
      if (params.button_style !== undefined) updated.button_style = params.button_style
      if (params.section_style !== undefined) updated.section_style = params.section_style
      if (params.overall_vibe !== undefined) updated.overall_vibe = params.overall_vibe
      if (params.custom_css !== undefined) updated.custom_css = params.custom_css

      const { error } = await supabase
        .from('site_config')
        .update({ page_design_tokens: updated as unknown as Json })
        .eq('id', 1)

      if (error) {
        return { success: false, error: error.message }
      }

      return {
        success: true,
        data: { message: 'Design tokens saved. All future pages will inherit these preferences.', tokens: updated },
      }
    },
  },

  // -----------------------------------------------------------------------
  // get_page_design_tokens
  // -----------------------------------------------------------------------
  {
    name: 'get_page_design_tokens',
    description:
      'Get the current brand colors and page design tokens. Always call this before creating a new page to ensure brand consistency across all pages.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute() {
      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('site_config')
        .select('brand_colors, page_design_tokens')
        .eq('id', 1)
        .single()

      if (error || !data) {
        return { success: false, error: error?.message ?? 'Site config not found' }
      }

      return {
        success: true,
        data: {
          brand_colors: data.brand_colors,
          design_tokens: data.page_design_tokens,
        },
      }
    },
  },
]
