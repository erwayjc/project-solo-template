'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/helpers'
import type { Lead } from '@/types/database'

/**
 * Capture a lead from an opt-in form. Uses the admin client because
 * leads are inserted by anonymous visitors (no auth session).
 */
export async function captureLead(
  email: string,
  name?: string,
  source?: string
): Promise<Lead> {
  const supabase = createAdminClient()

  // Upsert on email — if the lead already exists, update the name/source
  const { data, error } = await supabase
    .from('leads')
    .upsert(
      {
        email,
        name: name || null,
        source: source || 'opt-in',
        status: 'new',
      },
      { onConflict: 'email' }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to capture lead: ${error.message}`)
  }

  return data as Lead
}

export async function getLeads(filters?: {
  status?: string
  source?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<{ leads: Lead[]; count: number }> {
  const { supabase } = await requireAdmin()

  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.source) {
    query = query.eq('source', filters.source)
  }

  if (filters?.search) {
    // Sanitize search input: escape PostgREST special characters to prevent filter injection
    const sanitized = filters.search.replace(/[%_\\,().]/g, (c) => `\\${c}`)
    query = query.or(
      `email.ilike.%${sanitized}%,name.ilike.%${sanitized}%`
    )
  }

  query = query.order('created_at', { ascending: false })

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  if (filters?.offset) {
    query = query.range(
      filters.offset,
      filters.offset + (filters.limit || 50) - 1
    )
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch leads: ${error.message}`)
  }

  return { leads: data as Lead[], count: count ?? 0 }
}

export async function updateLeadStatus(
  id: string,
  status: 'new' | 'nurturing' | 'qualified' | 'converted' | 'lost'
): Promise<Lead> {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update lead status: ${error.message}`)
  }

  return data as Lead
}

export async function getLeadStats(): Promise<{
  total: number
  new: number
  nurturing: number
  qualified: number
  converted: number
  lost: number
  thisWeek: number
  thisMonth: number
}> {
  const { supabase } = await requireAdmin()

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Use count queries instead of loading all rows into memory
  const [
    totalResult,
    newResult,
    nurturingResult,
    qualifiedResult,
    convertedResult,
    lostResult,
    weekResult,
    monthResult,
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'nurturing'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'qualified'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'converted'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'lost'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
    supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
  ])

  if (totalResult.error) {
    throw new Error(`Failed to fetch lead stats: ${totalResult.error.message}`)
  }

  return {
    total: totalResult.count ?? 0,
    new: newResult.count ?? 0,
    nurturing: nurturingResult.count ?? 0,
    qualified: qualifiedResult.count ?? 0,
    converted: convertedResult.count ?? 0,
    lost: lostResult.count ?? 0,
    thisWeek: weekResult.count ?? 0,
    thisMonth: monthResult.count ?? 0,
  }
}
