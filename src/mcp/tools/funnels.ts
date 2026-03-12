// ---------------------------------------------------------------------------
// Funnel Tools — CRUD + analytics for conversion-focused page sequences
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizePageHtml } from '@/lib/utils/sanitize'
import { customPageSlugSchema } from '@/lib/utils/validation'
import type { Json } from '@/lib/supabase/types'
import type { ToolDefinition } from '../types'

const MAX_HTML_SIZE = 256 * 1024 // 256KB

interface StepInput {
  slug: string
  html_content: string
  seo?: Record<string, string>
  step_type: string
  expected_action: string
  step_order?: number
  product_id?: string
  email_sequence_id?: string
  is_published?: boolean
}

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // create_funnel
  // -----------------------------------------------------------------------
  {
    name: 'create_funnel',
    description:
      'Create a complete funnel with all pages and steps in one operation. Each step creates a new custom page and wires it into the funnel sequence. Minimum 2 steps required.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Funnel name (e.g. "Spring Lead Magnet Funnel")',
        },
        description: {
          type: 'string',
          description: 'Brief description of the funnel purpose',
        },
        goal_type: {
          type: 'string',
          enum: ['lead_capture', 'direct_sale', 'lead_to_sale', 'upsell'],
          description: 'The primary conversion goal of this funnel',
        },
        steps: {
          type: 'array',
          description: 'Ordered list of funnel steps (min 2). Each step creates a page.',
          items: {
            type: 'object',
            properties: {
              slug: {
                type: 'string',
                description: 'URL slug for the page (lowercase, hyphens only)',
              },
              html_content: {
                type: 'string',
                description: 'Full HTML content for the page body',
              },
              seo: {
                type: 'object',
                description: 'SEO metadata',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  og_image: { type: 'string' },
                  keywords: { type: 'string' },
                },
              },
              step_type: {
                type: 'string',
                enum: ['landing', 'thank_you', 'sales', 'upsell', 'content'],
                description: 'The type of this step in the funnel',
              },
              expected_action: {
                type: 'string',
                enum: ['opt_in', 'purchase', 'view', 'click_through'],
                description: 'The action visitors should take on this step',
              },
              product_id: {
                type: 'string',
                description: 'Product UUID if this step involves a purchase',
              },
              email_sequence_id: {
                type: 'string',
                description: 'Email sequence UUID to enroll leads from this step',
              },
              is_published: {
                type: 'boolean',
                description: 'Whether to publish this page immediately (default: false)',
              },
            },
            required: ['slug', 'html_content', 'step_type', 'expected_action'],
          },
        },
      },
      required: ['name', 'goal_type', 'steps'],
    },
    async execute(params) {
      const name = params.name as string
      const description = (params.description as string) || null
      const goalType = params.goal_type as string
      const steps = params.steps as StepInput[]

      // Validate minimum steps
      if (!steps || steps.length < 2) {
        return { success: false, error: 'Minimum 2 steps required for a funnel' }
      }

      const supabase = createAdminClient()

      // Validate all slugs upfront
      for (const step of steps) {
        const slugResult = customPageSlugSchema.safeParse(step.slug)
        if (!slugResult.success) {
          return {
            success: false,
            error: `Invalid slug "${step.slug}": ${slugResult.error.issues[0]?.message || 'Invalid format'}`,
          }
        }
        if (Buffer.byteLength(step.html_content, 'utf-8') > MAX_HTML_SIZE) {
          return { success: false, error: `HTML content for "${step.slug}" exceeds maximum size of 256KB` }
        }
      }

      // Validate product_ids exist
      for (const step of steps) {
        if (step.product_id) {
          const { data: product } = await supabase
            .from('products')
            .select('id')
            .eq('id', step.product_id)
            .single()
          if (!product) {
            return { success: false, error: `Product not found: ${step.product_id}` }
          }
        }
      }

      // Validate email_sequence_ids exist
      for (const step of steps) {
        if (step.email_sequence_id) {
          const { data: sequence } = await supabase
            .from('email_sequences')
            .select('id')
            .eq('id', step.email_sequence_id)
            .single()
          if (!sequence) {
            return { success: false, error: `Email sequence not found: ${step.email_sequence_id}` }
          }
        }
      }

      // Check for duplicate slugs in the database
      const slugs = steps.map((s) => s.slug)
      const { data: existingPages } = await supabase
        .from('pages')
        .select('slug')
        .in('slug', slugs)
      if (existingPages && existingPages.length > 0) {
        const dupes = existingPages.map((p) => p.slug).join(', ')
        return { success: false, error: `Page slugs already exist: ${dupes}` }
      }

      // Create funnel record
      const { data: funnel, error: funnelError } = await supabase
        .from('funnels')
        .insert({ name, description, goal_type: goalType })
        .select()
        .single()

      if (funnelError || !funnel) {
        return { success: false, error: funnelError?.message || 'Failed to create funnel' }
      }

      // Create pages and steps sequentially
      const createdSteps: Array<{
        step_order: number
        slug: string
        page_url: string
        step_type: string
      }> = []

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        const sanitizedHtml = sanitizePageHtml(step.html_content)

        // Insert page
        const { data: page, error: pageError } = await supabase
          .from('pages')
          .insert({
            slug: step.slug,
            render_mode: 'custom',
            html_content: sanitizedHtml,
            seo: (step.seo ?? {}) as unknown as Json,
            is_published: step.is_published ?? false,
            sanitized_at: new Date().toISOString(),
            sections: [] as unknown as Json,
            container_type: 'funnel',
            funnel_id: funnel.id,
          })
          .select()
          .single()

        if (pageError || !page) {
          // Cleanup: delete funnel (cascades to steps)
          await supabase.from('funnels').delete().eq('id', funnel.id)
          return {
            success: false,
            error: `Failed to create page for step ${i + 1} ("${step.slug}"): ${pageError?.message || 'Unknown error'}`,
          }
        }

        // Insert funnel step
        const { error: stepError } = await supabase.from('funnel_steps').insert({
          funnel_id: funnel.id,
          page_id: page.id,
          step_order: i + 1,
          step_type: step.step_type,
          expected_action: step.expected_action,
          product_id: step.product_id || null,
          email_sequence_id: step.email_sequence_id || null,
        })

        if (stepError) {
          await supabase.from('funnels').delete().eq('id', funnel.id)
          return {
            success: false,
            error: `Failed to create funnel step ${i + 1}: ${stepError.message}`,
          }
        }

        createdSteps.push({
          step_order: i + 1,
          slug: step.slug,
          page_url: `/p/${step.slug}`,
          step_type: step.step_type,
        })
      }

      return {
        success: true,
        data: {
          funnel_id: funnel.id,
          name: funnel.name,
          goal_type: funnel.goal_type,
          status: funnel.status,
          steps: createdSteps,
        },
      }
    },
  },

  // -----------------------------------------------------------------------
  // update_funnel
  // -----------------------------------------------------------------------
  {
    name: 'update_funnel',
    description:
      'Update a funnel: change name/description/status, add or remove steps, or reorder existing steps.',
    inputSchema: {
      type: 'object',
      properties: {
        funnel_id: {
          type: 'string',
          description: 'The funnel UUID to update',
        },
        name: { type: 'string', description: 'New funnel name' },
        description: { type: 'string', description: 'New description' },
        status: {
          type: 'string',
          enum: ['draft', 'active', 'paused', 'archived'],
          description: 'New funnel status',
        },
        add_steps: {
          type: 'array',
          description: 'New steps to add to the funnel',
          items: {
            type: 'object',
            properties: {
              slug: { type: 'string' },
              html_content: { type: 'string' },
              seo: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  og_image: { type: 'string' },
                  keywords: { type: 'string' },
                },
              },
              step_type: { type: 'string', enum: ['landing', 'thank_you', 'sales', 'upsell', 'content'] },
              expected_action: { type: 'string', enum: ['opt_in', 'purchase', 'view', 'click_through'] },
              step_order: { type: 'number', description: 'Position in the funnel' },
              product_id: { type: 'string' },
              email_sequence_id: { type: 'string' },
              is_published: { type: 'boolean' },
            },
            required: ['slug', 'html_content', 'step_type', 'expected_action', 'step_order'],
          },
        },
        remove_step_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Step UUIDs to remove from the funnel (pages revert to standalone)',
        },
        reorder: {
          type: 'array',
          description: 'Reorder steps: array of { step_id, step_order }',
          items: {
            type: 'object',
            properties: {
              step_id: { type: 'string' },
              step_order: { type: 'number' },
            },
            required: ['step_id', 'step_order'],
          },
        },
      },
      required: ['funnel_id'],
    },
    async execute(params) {
      const funnelId = params.funnel_id as string
      const supabase = createAdminClient()

      // Verify funnel exists
      const { data: funnel, error: findError } = await supabase
        .from('funnels')
        .select('*')
        .eq('id', funnelId)
        .single()

      if (findError || !funnel) {
        return { success: false, error: `Funnel not found: ${funnelId}` }
      }

      // Update funnel metadata
      const updates: Record<string, unknown> = {}
      if (params.name) updates.name = params.name
      if (params.description !== undefined) updates.description = params.description
      if (params.status) updates.status = params.status

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString()
        const { error } = await supabase.from('funnels').update(updates).eq('id', funnelId)
        if (error) return { success: false, error: error.message }
      }

      // Remove steps
      const removeStepIds = params.remove_step_ids as string[] | undefined
      if (removeStepIds && removeStepIds.length > 0) {
        // Check that removal won't drop below 2 steps
        const { count: currentStepCount } = await supabase
          .from('funnel_steps')
          .select('id', { count: 'exact', head: true })
          .eq('funnel_id', funnelId)

        const addCount = (params.add_steps as unknown[] | undefined)?.length ?? 0
        const remainingSteps = (currentStepCount ?? 0) - removeStepIds.length + addCount
        if (remainingSteps < 2) {
          return { success: false, error: `Cannot remove steps: funnel must have at least 2 steps (would have ${remainingSteps})` }
        }

        // Get page IDs for the steps being removed
        const { data: stepsToRemove } = await supabase
          .from('funnel_steps')
          .select('id, page_id')
          .in('id', removeStepIds)
          .eq('funnel_id', funnelId)

        if (stepsToRemove && stepsToRemove.length > 0) {
          // Delete the steps
          await supabase
            .from('funnel_steps')
            .delete()
            .in('id', stepsToRemove.map((s) => s.id))

          // Revert pages to standalone
          await supabase
            .from('pages')
            .update({ container_type: 'standalone', funnel_id: null })
            .in('id', stepsToRemove.map((s) => s.page_id))
        }
      }

      // Add new steps
      const addSteps = params.add_steps as StepInput[] | undefined
      if (addSteps && addSteps.length > 0) {
        for (const step of addSteps) {
          const slugResult = customPageSlugSchema.safeParse(step.slug)
          if (!slugResult.success) {
            return { success: false, error: `Invalid slug "${step.slug}": ${slugResult.error.issues[0]?.message}` }
          }
          if (Buffer.byteLength(step.html_content, 'utf-8') > MAX_HTML_SIZE) {
            return { success: false, error: `HTML content for "${step.slug}" exceeds 256KB` }
          }

          const sanitizedHtml = sanitizePageHtml(step.html_content)
          const { data: page, error: pageError } = await supabase
            .from('pages')
            .insert({
              slug: step.slug,
              render_mode: 'custom',
              html_content: sanitizedHtml,
              seo: (step.seo ?? {}) as unknown as Json,
              is_published: step.is_published ?? false,
              sanitized_at: new Date().toISOString(),
              sections: [] as unknown as Json,
              container_type: 'funnel',
              funnel_id: funnelId,
            })
            .select()
            .single()

          if (pageError || !page) {
            return { success: false, error: `Failed to create page "${step.slug}": ${pageError?.message}` }
          }

          const { error: stepError } = await supabase.from('funnel_steps').insert({
            funnel_id: funnelId,
            page_id: page.id,
            step_order: step.step_order!,
            step_type: step.step_type,
            expected_action: step.expected_action,
            product_id: step.product_id || null,
            email_sequence_id: step.email_sequence_id || null,
          })

          if (stepError) {
            return { success: false, error: `Failed to create step for "${step.slug}": ${stepError.message}` }
          }
        }
      }

      // Reorder steps
      const reorder = params.reorder as Array<{ step_id: string; step_order: number }> | undefined
      if (reorder && reorder.length > 0) {
        // Validate all step IDs belong to this funnel
        const stepIds = reorder.map((r) => r.step_id)
        const { data: existingSteps } = await supabase
          .from('funnel_steps')
          .select('id')
          .in('id', stepIds)
          .eq('funnel_id', funnelId)

        const existingIds = new Set(existingSteps?.map((s) => s.id) || [])
        const invalidIds = stepIds.filter((id) => !existingIds.has(id))
        if (invalidIds.length > 0) {
          return { success: false, error: `Step IDs not found in this funnel: ${invalidIds.join(', ')}` }
        }

        for (const r of reorder) {
          await supabase
            .from('funnel_steps')
            .update({ step_order: r.step_order })
            .eq('id', r.step_id)
            .eq('funnel_id', funnelId)
        }
      }

      // Fetch updated funnel with steps
      const { data: updatedFunnel } = await supabase
        .from('funnels')
        .select('*')
        .eq('id', funnelId)
        .single()

      const { data: updatedSteps } = await supabase
        .from('funnel_steps')
        .select('id, step_order, step_type, expected_action, page_id')
        .eq('funnel_id', funnelId)
        .order('step_order')

      return {
        success: true,
        data: {
          funnel: updatedFunnel,
          steps: updatedSteps,
        },
      }
    },
  },

  // -----------------------------------------------------------------------
  // get_funnel_stats
  // -----------------------------------------------------------------------
  {
    name: 'get_funnel_stats',
    description:
      'Get conversion analytics for a funnel: per-step views, conversions, rates, and drop-off metrics.',
    inputSchema: {
      type: 'object',
      properties: {
        funnel_id: {
          type: 'string',
          description: 'The funnel UUID to get stats for',
        },
        start_date: {
          type: 'string',
          description: 'ISO date string to filter events from (inclusive)',
        },
        end_date: {
          type: 'string',
          description: 'ISO date string to filter events until (inclusive)',
        },
      },
      required: ['funnel_id'],
    },
    async execute(params) {
      const funnelId = params.funnel_id as string
      const startDate = params.start_date as string | undefined
      const endDate = params.end_date as string | undefined

      const supabase = createAdminClient()

      // Verify funnel exists
      const { data: funnel, error: funnelError } = await supabase
        .from('funnels')
        .select('id, name, status, goal_type')
        .eq('id', funnelId)
        .single()

      if (funnelError || !funnel) {
        return { success: false, error: `Funnel not found: ${funnelId}` }
      }

      // Get steps with page info
      const { data: steps } = await supabase
        .from('funnel_steps')
        .select('id, step_order, step_type, expected_action, page_id')
        .eq('funnel_id', funnelId)
        .order('step_order')

      if (!steps || steps.length === 0) {
        return { success: true, data: { funnel, steps: [], overall_rate: 0 } }
      }

      // Get page titles
      const pageIds = steps.map((s) => s.page_id)
      const { data: pages } = await supabase
        .from('pages')
        .select('id, slug, seo')
        .in('id', pageIds)

      const pageMap = new Map(pages?.map((p) => [p.id, p]) || [])

      // Get event counts per step
      const stepStats = []
      for (const step of steps) {
        let viewQuery = supabase
          .from('funnel_events')
          .select('id', { count: 'exact', head: true })
          .eq('funnel_step_id', step.id)
          .eq('event_type', 'view')

        let conversionQuery = supabase
          .from('funnel_events')
          .select('id', { count: 'exact', head: true })
          .eq('funnel_step_id', step.id)
          .eq('event_type', 'conversion')

        if (startDate) {
          viewQuery = viewQuery.gte('created_at', startDate)
          conversionQuery = conversionQuery.gte('created_at', startDate)
        }
        if (endDate) {
          viewQuery = viewQuery.lte('created_at', endDate)
          conversionQuery = conversionQuery.lte('created_at', endDate)
        }

        const [{ count: views }, { count: conversions }] = await Promise.all([
          viewQuery,
          conversionQuery,
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
          page_title: pageTitle,
          page_slug: page?.slug,
          views: viewCount,
          conversions: conversionCount,
          conversion_rate: rate,
        })
      }

      // Calculate drop-off between steps
      for (let i = 1; i < stepStats.length; i++) {
        const prev = stepStats[i - 1]
        const curr = stepStats[i]
        const dropOff = prev.views > 0
          ? Math.round(((prev.views - curr.views) / prev.views) * 10000) / 100
          : 0
        ;(curr as Record<string, unknown>).drop_off_from_previous = dropOff
      }

      // Overall funnel rate: first step views to last step conversions
      const firstViews = stepStats[0]?.views ?? 0
      const lastConversions = stepStats[stepStats.length - 1]?.conversions ?? 0
      const overallRate = firstViews > 0
        ? Math.round((lastConversions / firstViews) * 10000) / 100
        : 0

      return {
        success: true,
        data: {
          funnel,
          steps: stepStats,
          overall_rate: overallRate,
        },
      }
    },
  },

  // -----------------------------------------------------------------------
  // list_funnels
  // -----------------------------------------------------------------------
  {
    name: 'list_funnels',
    description:
      'List all funnels with summary metrics: step count, total views, total conversions, and conversion rate.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'active', 'paused', 'archived'],
          description: 'Filter by funnel status (default: all)',
        },
      },
    },
    async execute(params) {
      const status = params.status as string | undefined
      const supabase = createAdminClient()

      let query = supabase
        .from('funnels')
        .select('*')
        .order('created_at', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }

      const { data: funnels, error } = await query

      if (error) {
        return { success: false, error: error.message }
      }

      if (!funnels || funnels.length === 0) {
        return { success: true, data: [] }
      }

      // Get step counts and event aggregates per funnel
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

      return { success: true, data: results }
    },
  },
]
