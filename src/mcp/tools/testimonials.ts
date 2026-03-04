// ---------------------------------------------------------------------------
// Testimonial Tools
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // create_testimonial
  // -----------------------------------------------------------------------
  {
    name: 'create_testimonial',
    description:
      'Create a new customer testimonial. Created as unpublished by default.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Customer name.' },
        quote: { type: 'string', description: 'Testimonial quote text.' },
        role: { type: 'string', description: 'Customer role or title.' },
        company: { type: 'string', description: 'Customer company name.' },
        image_url: {
          type: 'string',
          description: 'URL to customer photo/avatar.',
        },
      },
      required: ['name', 'quote'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('testimonials')
        .insert({
          name: params.name as string,
          quote: params.quote as string,
          role: (params.role as string) ?? null,
          company: (params.company as string) ?? null,
          image_url: (params.image_url as string) ?? null,
          is_published: false,
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // update_testimonial
  // -----------------------------------------------------------------------
  {
    name: 'update_testimonial',
    description: 'Update an existing testimonial.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Testimonial UUID.' },
        updates: {
          type: 'object',
          description: 'Fields to update.',
          properties: {
            name: { type: 'string' },
            quote: { type: 'string' },
            role: { type: 'string' },
            company: { type: 'string' },
            image_url: { type: 'string' },
            is_published: { type: 'boolean' },
            sort_order: { type: 'number' },
          },
        },
      },
      required: ['id', 'updates'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const id = params.id as string
      const raw = params.updates as Record<string, unknown>

      // Only allow known safe fields
      const allowedFields = ['name', 'quote', 'role', 'company', 'image_url', 'is_published', 'sort_order']
      const updates: Record<string, unknown> = {}
      for (const key of allowedFields) {
        if (key in raw) updates[key] = raw[key]
      }

      const { data, error } = await supabase
        .from('testimonials')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // delete_testimonial
  // -----------------------------------------------------------------------
  {
    name: 'delete_testimonial',
    description: 'Delete a testimonial by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Testimonial UUID to delete.' },
      },
      required: ['id'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      const { error } = await supabase
        .from('testimonials')
        .delete()
        .eq('id', params.id as string)

      if (error) return { success: false, error: error.message }
      return { success: true, data: { deleted: params.id } }
    },
  },

  // -----------------------------------------------------------------------
  // get_testimonials
  // -----------------------------------------------------------------------
  {
    name: 'get_testimonials',
    description: 'List testimonials, optionally filtering to published only.',
    inputSchema: {
      type: 'object',
      properties: {
        published_only: {
          type: 'boolean',
          description: 'If true, return only published testimonials.',
        },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()

      let query = supabase
        .from('testimonials')
        .select('*')
        .order('sort_order', { ascending: true })

      if (params.published_only) {
        query = query.eq('is_published', true)
      }

      const { data, error } = await query

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },
]
