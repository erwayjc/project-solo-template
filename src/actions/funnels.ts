'use server'

import { createClient } from '@/lib/supabase/server'

export async function getFunnels(status?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('funnels')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data: funnels, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  if (!funnels || funnels.length === 0) {
    return []
  }

  // Enrich with step counts and event aggregates
  const results = []
  for (const funnel of funnels) {
    const { count: stepCount } = await supabase
      .from('funnel_steps')
      .select('id', { count: 'exact', head: true })
      .eq('funnel_id', funnel.id)

    const { count: totalViews } = await supabase
      .from('funnel_events')
      .select('id', { count: 'exact', head: true })
      .eq('funnel_id', funnel.id)
      .eq('event_type', 'view')

    const { count: totalConversions } = await supabase
      .from('funnel_events')
      .select('id', { count: 'exact', head: true })
      .eq('funnel_id', funnel.id)
      .eq('event_type', 'conversion')

    const views = totalViews ?? 0
    const conversions = totalConversions ?? 0
    const rate = views > 0 ? Math.round((conversions / views) * 10000) / 100 : 0

    results.push({
      id: funnel.id,
      name: funnel.name,
      description: funnel.description,
      status: funnel.status,
      goal_type: funnel.goal_type,
      step_count: stepCount ?? 0,
      total_views: views,
      total_conversions: conversions,
      conversion_rate: rate,
      created_at: funnel.created_at,
    })
  }

  return results
}

export async function getFunnelWithStats(funnelId: string) {
  const supabase = await createClient()

  // Fetch funnel
  const { data: funnel, error: funnelError } = await supabase
    .from('funnels')
    .select('*')
    .eq('id', funnelId)
    .single()

  if (funnelError || !funnel) {
    throw new Error('Funnel not found')
  }

  // Fetch steps with page info
  const { data: steps } = await supabase
    .from('funnel_steps')
    .select('id, step_order, step_type, expected_action, page_id, product_id, email_sequence_id')
    .eq('funnel_id', funnelId)
    .order('step_order')

  if (!steps || steps.length === 0) {
    return { funnel, steps: [], overall_rate: 0 }
  }

  // Get page info
  const pageIds = steps.map((s) => s.page_id)
  const { data: pages } = await supabase
    .from('pages')
    .select('id, slug, seo, is_published')
    .in('id', pageIds)

  const pageMap = new Map(pages?.map((p) => [p.id, p]) || [])

  // Get per-step metrics
  const stepStats = []
  for (const step of steps) {
    const [{ count: views }, { count: conversions }] = await Promise.all([
      supabase
        .from('funnel_events')
        .select('id', { count: 'exact', head: true })
        .eq('funnel_step_id', step.id)
        .eq('event_type', 'view'),
      supabase
        .from('funnel_events')
        .select('id', { count: 'exact', head: true })
        .eq('funnel_step_id', step.id)
        .eq('event_type', 'conversion'),
    ])

    const viewCount = views ?? 0
    const conversionCount = conversions ?? 0
    const rate = viewCount > 0 ? Math.round((conversionCount / viewCount) * 10000) / 100 : 0

    const page = pageMap.get(step.page_id)
    const pageTitle = (page?.seo as Record<string, string> | null)?.title || page?.slug || 'Untitled'

    stepStats.push({
      step_id: step.id,
      step_order: step.step_order,
      step_type: step.step_type,
      expected_action: step.expected_action,
      page_title: pageTitle,
      page_slug: page?.slug ?? '',
      is_published: page?.is_published ?? false,
      views: viewCount,
      conversions: conversionCount,
      conversion_rate: rate,
    })
  }

  // Overall funnel rate
  const firstViews = stepStats[0]?.views ?? 0
  const lastConversions = stepStats[stepStats.length - 1]?.conversions ?? 0
  const overallRate = firstViews > 0
    ? Math.round((lastConversions / firstViews) * 10000) / 100
    : 0

  return { funnel, steps: stepStats, overall_rate: overallRate }
}
