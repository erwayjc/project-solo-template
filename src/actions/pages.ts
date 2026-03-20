'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/helpers'
import { sanitizePageHtml } from '@/lib/utils/sanitize'
import type { Page, PageInsert, PageUpdate } from '@/types/database'
import type { Json } from '@/lib/supabase/types'
import { z } from 'zod'

const RESERVED_SLUGS = [
  'home', 'sales', 'blog', 'login', 'checkout',
  'privacy', 'terms', 'opt-in', 'thank-you',
  'admin', 'portal', 'api', 'p', 'pages',
]

const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
  .refine((s) => !RESERVED_SLUGS.includes(s), 'This slug is reserved')

const seoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(500).default(''),
  og_image: z.string().default(''),
  keywords: z.array(z.string()).default([]),
})

const createPageSchema = z.object({
  slug: slugSchema,
  render_mode: z.enum(['sections', 'custom']),
  seo: seoSchema,
  is_published: z.boolean().default(false),
  sections: z.array(z.record(z.string(), z.unknown())).optional(),
  html_content: z.string().max(262144).optional(), // 256KB
})

const updatePageSchema = z.object({
  seo: seoSchema.optional(),
  is_published: z.boolean().optional(),
  sections: z.array(z.record(z.string(), z.unknown())).optional(),
  html_content: z.string().max(262144).optional(),
})

export async function listPages() {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('pages')
    .select('id, slug, seo, is_published, render_mode, container_type, view_count, created_at')
    .eq('container_type', 'website')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to list pages: ${error.message}`)
  }

  return data ?? []
}

export async function getPage(slug: string): Promise<Page | null> {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch page: ${error.message}`)
  }

  return data as Page
}

export async function createPage(input: z.infer<typeof createPageSchema>) {
  const parsed = createPageSchema.parse(input)
  const { supabase } = await requireAdmin()

  const insertData: PageInsert = {
    slug: parsed.slug,
    render_mode: parsed.render_mode,
    seo: parsed.seo as unknown as Json,
    is_published: parsed.is_published,
    container_type: 'website',
  }

  if (parsed.render_mode === 'sections') {
    insertData.sections = (parsed.sections ?? []) as unknown as Json
  } else if (parsed.render_mode === 'custom' && parsed.html_content) {
    insertData.html_content = sanitizePageHtml(parsed.html_content)
    insertData.sanitized_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('pages')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('A page with this slug already exists')
    }
    throw new Error(`Failed to create page: ${error.message}`)
  }

  return data as Page
}

export async function updatePage(slug: string, input: z.infer<typeof updatePageSchema>) {
  const parsed = updatePageSchema.parse(input)
  const { supabase } = await requireAdmin()

  // Fetch current page to check render_mode and handle html_content_previous
  const { data: existing, error: fetchError } = await supabase
    .from('pages')
    .select('render_mode, html_content')
    .eq('slug', slug)
    .single()

  if (fetchError) {
    throw new Error(`Page not found: ${fetchError.message}`)
  }

  const updateData: PageUpdate = {}

  if (parsed.seo) {
    updateData.seo = parsed.seo as unknown as Json
  }

  if (parsed.is_published !== undefined) {
    updateData.is_published = parsed.is_published
  }

  if (parsed.sections && existing.render_mode === 'sections') {
    updateData.sections = parsed.sections as unknown as Json
  }

  if (parsed.html_content !== undefined && existing.render_mode === 'custom') {
    // Save current content for undo
    if (existing.html_content) {
      updateData.html_content_previous = existing.html_content
    }
    updateData.html_content = sanitizePageHtml(parsed.html_content)
    updateData.sanitized_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('pages')
    .update(updateData)
    .eq('slug', slug)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update page: ${error.message}`)
  }

  return data as Page
}

export async function deletePage(slug: string) {
  const { supabase } = await requireAdmin()

  // Check if page is referenced by funnel steps
  const { data: page } = await supabase
    .from('pages')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!page) {
    throw new Error('Page not found')
  }

  const { count } = await supabase
    .from('funnel_steps')
    .select('id', { count: 'exact', head: true })
    .eq('page_id', page.id)

  if (count && count > 0) {
    throw new Error('Cannot delete this page — it is used in a funnel. Remove it from the funnel first.')
  }

  const { error } = await supabase
    .from('pages')
    .delete()
    .eq('slug', slug)

  if (error) {
    throw new Error(`Failed to delete page: ${error.message}`)
  }
}

export async function getPublishedWebsitePages() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('pages')
    .select('slug, seo, render_mode')
    .eq('container_type', 'website')
    .eq('is_published', true)
    .order('created_at', { ascending: true })

  if (error) {
    return []
  }

  return (data ?? []).map((page) => {
    const seo = page.seo as Record<string, unknown> | null
    return {
      slug: page.slug,
      title: (seo?.title as string) || page.slug,
      render_mode: page.render_mode,
    }
  })
}
