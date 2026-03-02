// ---------------------------------------------------------------------------
// Lead & Customer Management Tools
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/client'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // get_leads
  // -----------------------------------------------------------------------
  {
    name: 'get_leads',
    description:
      'Retrieve leads from the database with optional filters for status, source, and tags. Supports pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by lead status, e.g. "new", "contacted", "qualified", "converted".',
        },
        source: {
          type: 'string',
          description: 'Filter by acquisition source, e.g. "organic", "referral", "paid".',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter leads that have ALL of the specified tags.',
        },
        limit: {
          type: 'number',
          description: 'Max records to return (default 50).',
        },
        offset: {
          type: 'number',
          description: 'Number of records to skip (default 0).',
        },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()
      const limit = (params.limit as number) ?? 50
      const offset = (params.offset as number) ?? 0

      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (params.status) query = query.eq('status', params.status as string)
      if (params.source) query = query.eq('source', params.source as string)
      if (params.tags) query = query.contains('tags', params.tags as string[])

      const { data, error, count } = await query

      if (error) return { success: false, error: error.message }
      return { success: true, data: { leads: data, total: count ?? 0, limit, offset } }
    },
  },

  // -----------------------------------------------------------------------
  // update_lead_status
  // -----------------------------------------------------------------------
  {
    name: 'update_lead_status',
    description:
      'Update the status of a lead. Valid statuses: new, contacted, qualified, converted, lost.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Lead UUID.' },
        status: {
          type: 'string',
          enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
          description: 'New status value.',
        },
      },
      required: ['id', 'status'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('leads')
        .update({
          status: params.status as string,
        })
        .eq('id', params.id as string)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // get_customers
  // -----------------------------------------------------------------------
  {
    name: 'get_customers',
    description:
      'Retrieve customers — leads who have made at least one purchase. Returns lead info joined with their purchase history.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max records (default 50).' },
        offset: { type: 'number', description: 'Records to skip (default 0).' },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()
      const limit = (params.limit as number) ?? 50
      const offset = (params.offset as number) ?? 0

      // Get leads who have purchases
      const { data: purchases, error: pErr } = await supabase
        .from('purchases')
        .select('user_id')
        .not('user_id', 'is', null)

      if (pErr) return { success: false, error: pErr.message }

      const customerIds = [...new Set((purchases ?? []).map((p) => p.user_id as string))]
      if (customerIds.length === 0) {
        return { success: true, data: { customers: [], total: 0, limit, offset } }
      }

      const { data: customers, error, count } = await supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .in('id', customerIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) return { success: false, error: error.message }

      // Attach purchase counts
      const customerData = await Promise.all(
        (customers ?? []).map(async (customer: Record<string, unknown>) => {
          const { count: purchaseCount } = await supabase
            .from('purchases')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', customer.id as string)

          return { ...customer, purchaseCount: purchaseCount ?? 0 }
        })
      )

      return {
        success: true,
        data: { customers: customerData, total: count ?? 0, limit, offset },
      }
    },
  },

  // -----------------------------------------------------------------------
  // get_revenue_stats
  // -----------------------------------------------------------------------
  {
    name: 'get_revenue_stats',
    description:
      'Get revenue statistics from Stripe and the local purchases table. Includes total revenue, number of transactions, and average order value for a given time period.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['day', 'week', 'month', 'year'],
          description: 'Time period to aggregate over (default "month").',
        },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()
      const period = (params.period as string) ?? 'month'

      // Calculate start date
      const now = new Date()
      const startDate = new Date(now)
      switch (period) {
        case 'day':
          startDate.setDate(now.getDate() - 1)
          break
        case 'week':
          startDate.setDate(now.getDate() - 7)
          break
        case 'month':
          startDate.setMonth(now.getMonth() - 1)
          break
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1)
          break
      }

      // Query local purchases
      const { data: purchases, error } = await supabase
        .from('purchases')
        .select('amount, currency, created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })

      if (error) return { success: false, error: error.message }

      const totalRevenue = (purchases ?? []).reduce(
        (sum, p) => sum + ((p.amount as number) ?? 0),
        0
      )
      const transactionCount = (purchases ?? []).length
      const avgOrderValue =
        transactionCount > 0 ? totalRevenue / transactionCount : 0

      // Try to get Stripe balance for a cross-check
      let stripeBalance: unknown = null
      try {
        stripeBalance = await stripe.balance.retrieve()
      } catch {
        // Stripe may not be configured — non-fatal
      }

      return {
        success: true,
        data: {
          period,
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
          totalRevenue,
          transactionCount,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
          stripeBalance,
        },
      }
    },
  },
]
