'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/helpers'
import type { SiteConfig, Page } from '@/types/database'
import type { Json } from '@/lib/supabase/types'

export async function getSiteConfig(): Promise<SiteConfig> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('site_config')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) {
    throw new Error(`Failed to fetch site config: ${error.message}`)
  }

  return data as SiteConfig
}

export async function updateSiteConfig(
  fields: Partial<Omit<SiteConfig, 'id'>>
) {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('site_config')
    .update(fields)
    .eq('id', 1)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update site config: ${error.message}`)
  }

  return data as SiteConfig
}

export async function getPageContent(slug: string): Promise<Page | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    throw new Error(`Failed to fetch page: ${error.message}`)
  }

  return data as Page
}

export async function updatePageContent(
  slug: string,
  sections: Record<string, unknown>[]
) {
  const { supabase } = await requireAdmin()

  // Upsert the page — create if it doesn't exist, update if it does
  const { data, error } = await supabase
    .from('pages')
    .upsert(
      { slug, sections: sections as unknown as Json },
      { onConflict: 'slug' }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update page content: ${error.message}`)
  }

  return data as Page
}
