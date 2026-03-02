// ---------------------------------------------------------------------------
// Analytics & Reporting Tools
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // get_dashboard_summary
  // -----------------------------------------------------------------------
  {
    name: 'get_dashboard_summary',
    description:
      'Get a high-level dashboard summary with key metrics across leads, revenue, content, courses, and support. Useful for a quick health check.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute() {
      const supabase = createAdminClient()

      // Parallel queries for speed
      const [
        leadsResult,
        customersResult,
        revenueResult,
        postsResult,
        socialResult,
        ticketsResult,
        lessonsResult,
        enrollmentsResult,
      ] = await Promise.all([
        // Total leads + new leads (last 7 days)
        supabase.from('leads').select('id, created_at', { count: 'exact' }),
        // Customers (leads with purchases)
        supabase.from('purchases').select('user_id'),
        // Revenue this month
        supabase
          .from('purchases')
          .select('amount')
          .gte(
            'created_at',
            new Date(
              new Date().getFullYear(),
              new Date().getMonth(),
              1
            ).toISOString()
          ),
        // Blog posts
        supabase
          .from('blog_posts')
          .select('id, status', { count: 'exact' }),
        // Social queue
        supabase
          .from('content_queue')
          .select('id, status', { count: 'exact' }),
        // Open support tickets
        supabase
          .from('support_tickets')
          .select('id, status', { count: 'exact' })
          .in('status', ['open', 'in_progress']),
        // Total lessons
        supabase.from('lessons').select('id', { count: 'exact' }),
        // Sequence enrollments this month
        supabase
          .from('sequence_enrollments')
          .select('id', { count: 'exact' })
          .gte(
            'created_at',
            new Date(
              new Date().getFullYear(),
              new Date().getMonth(),
              1
            ).toISOString()
          ),
      ])

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const newLeads = (leadsResult.data ?? []).filter(
        (l) => new Date(l.created_at as string) >= sevenDaysAgo
      ).length

      const uniqueCustomerIds = new Set(
        (customersResult.data ?? []).map((p) => p.user_id)
      )

      const monthlyRevenue = (revenueResult.data ?? []).reduce(
        (sum, p) => sum + ((p.amount as number) ?? 0),
        0
      )

      const publishedPosts = (postsResult.data ?? []).filter(
        (p) => p.status === 'published'
      ).length

      return {
        success: true,
        data: {
          leads: {
            total: leadsResult.count ?? 0,
            newLast7Days: newLeads,
          },
          customers: {
            total: uniqueCustomerIds.size,
          },
          revenue: {
            thisMonth: monthlyRevenue,
          },
          content: {
            blogPosts: postsResult.count ?? 0,
            publishedPosts,
            socialQueueItems: socialResult.count ?? 0,
          },
          support: {
            openTickets: ticketsResult.count ?? 0,
          },
          courses: {
            totalLessons: lessonsResult.count ?? 0,
          },
          email: {
            enrollmentsThisMonth: enrollmentsResult.count ?? 0,
          },
        },
      }
    },
  },

  // -----------------------------------------------------------------------
  // get_analytics
  // -----------------------------------------------------------------------
  {
    name: 'get_analytics',
    description:
      'Get detailed analytics for a specific domain (email, content, sales, retention) over a given period.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          enum: ['email', 'content', 'sales', 'retention'],
          description: 'Analytics domain to query.',
        },
        period: {
          type: 'string',
          enum: ['day', 'week', 'month', 'quarter', 'year'],
          description: 'Time period (default "month").',
        },
      },
      required: ['domain'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const domain = params.domain as string
      const period = (params.period as string) ?? 'month'

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
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3)
          break
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1)
          break
      }
      const since = startDate.toISOString()

      if (domain === 'email') {
        const [sequences, sends, enrollments] = await Promise.all([
          supabase
            .from('email_sequences')
            .select('id, name, is_active'),
          supabase
            .from('email_sends')
            .select('status, sent_at')
            .gte('sent_at', since),
          supabase
            .from('sequence_enrollments')
            .select('id, created_at')
            .gte('created_at', since),
        ])

        const sentCount = (sends.data ?? []).filter((s) => s.status === 'sent').length
        const failedCount = (sends.data ?? []).filter((s) => s.status === 'failed').length

        return {
          success: true,
          data: {
            domain: 'email',
            period,
            activeSequences: (sequences.data ?? []).filter((s) => s.is_active).length,
            totalSequences: (sequences.data ?? []).length,
            emailsSent: sentCount,
            emailsFailed: failedCount,
            newEnrollments: (enrollments.data ?? []).length,
          },
        }
      }

      if (domain === 'content') {
        const [posts, social] = await Promise.all([
          supabase
            .from('blog_posts')
            .select('id, status, created_at, published_at')
            .gte('created_at', since),
          supabase
            .from('content_queue')
            .select('id, platform, status, created_at')
            .gte('created_at', since),
        ])

        const publishedPosts = (posts.data ?? []).filter(
          (p) => p.status === 'published'
        ).length

        // Group social by platform
        const platformCounts: Record<string, number> = {}
        for (const item of social.data ?? []) {
          const platform = item.platform as string
          platformCounts[platform] = (platformCounts[platform] ?? 0) + 1
        }

        return {
          success: true,
          data: {
            domain: 'content',
            period,
            blogPostsCreated: (posts.data ?? []).length,
            blogPostsPublished: publishedPosts,
            socialPostsCreated: (social.data ?? []).length,
            socialByPlatform: platformCounts,
          },
        }
      }

      if (domain === 'sales') {
        const [purchases, leads] = await Promise.all([
          supabase
            .from('purchases')
            .select('amount, currency, product_id, created_at')
            .gte('created_at', since),
          supabase
            .from('leads')
            .select('id, status, created_at')
            .gte('created_at', since),
        ])

        const totalRevenue = (purchases.data ?? []).reduce(
          (sum, p) => sum + ((p.amount as number) ?? 0),
          0
        )

        const convertedLeads = (leads.data ?? []).filter(
          (l) => l.status === 'converted'
        ).length
        const totalNewLeads = (leads.data ?? []).length
        const conversionRate =
          totalNewLeads > 0 ? (convertedLeads / totalNewLeads) * 100 : 0

        return {
          success: true,
          data: {
            domain: 'sales',
            period,
            totalRevenue,
            transactions: (purchases.data ?? []).length,
            avgOrderValue:
              (purchases.data ?? []).length > 0
                ? Math.round((totalRevenue / (purchases.data ?? []).length) * 100) / 100
                : 0,
            newLeads: totalNewLeads,
            convertedLeads,
            conversionRate: Math.round(conversionRate * 100) / 100,
          },
        }
      }

      if (domain === 'retention') {
        const [progress, tickets, enrollments] = await Promise.all([
          supabase
            .from('lesson_progress')
            .select('user_id, completed, completed_at')
            .gte('completed_at', since),
          supabase
            .from('support_tickets')
            .select('id, status, created_at, resolved_at')
            .gte('created_at', since),
          supabase
            .from('sequence_enrollments')
            .select('id, status, created_at')
            .gte('created_at', since),
        ])

        const activeStudents = new Set(
          (progress.data ?? []).map((p) => p.user_id)
        ).size
        const completedLessons = (progress.data ?? []).filter(
          (p) => p.completed
        ).length
        const resolvedTickets = (tickets.data ?? []).filter(
          (t) => t.status === 'resolved' || t.status === 'closed'
        ).length

        return {
          success: true,
          data: {
            domain: 'retention',
            period,
            activeStudents,
            lessonsCompleted: completedLessons,
            supportTickets: (tickets.data ?? []).length,
            ticketsResolved: resolvedTickets,
            resolutionRate:
              (tickets.data ?? []).length > 0
                ? Math.round(
                    (resolvedTickets / (tickets.data ?? []).length) * 100 * 100
                  ) / 100
                : 0,
            emailEnrollments: (enrollments.data ?? []).length,
          },
        }
      }

      return { success: false, error: `Unknown analytics domain: ${domain}` }
    },
  },

  // -----------------------------------------------------------------------
  // generate_weekly_briefing
  // -----------------------------------------------------------------------
  {
    name: 'generate_weekly_briefing',
    description:
      'Generate a comprehensive weekly business briefing. Gathers key metrics across all domains and uses Claude to produce a human-readable summary with insights and recommendations.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute() {
      const supabase = createAdminClient()
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      const since = oneWeekAgo.toISOString()

      // Gather metrics in parallel
      const [
        newLeads,
        purchases,
        blogPosts,
        socialPosts,
        emailsSent,
        ticketsCreated,
        ticketsResolved,
        lessonProgress,
      ] = await Promise.all([
        supabase
          .from('leads')
          .select('id, source, status', { count: 'exact' })
          .gte('created_at', since),
        supabase
          .from('purchases')
          .select('amount, product_id')
          .gte('created_at', since),
        supabase
          .from('blog_posts')
          .select('id, title, status')
          .gte('created_at', since),
        supabase
          .from('content_queue')
          .select('id, platform, status')
          .gte('created_at', since),
        supabase
          .from('email_sends')
          .select('status')
          .gte('sent_at', since),
        supabase
          .from('support_tickets')
          .select('id', { count: 'exact' })
          .gte('created_at', since),
        supabase
          .from('support_tickets')
          .select('id', { count: 'exact' })
          .gte('resolved_at', since),
        supabase
          .from('lesson_progress')
          .select('user_id, completed')
          .gte('completed_at', since),
      ])

      const weeklyRevenue = (purchases.data ?? []).reduce(
        (sum, p) => sum + ((p.amount as number) ?? 0),
        0
      )

      const metricsBlock = JSON.stringify(
        {
          newLeads: newLeads.count ?? 0,
          revenue: weeklyRevenue,
          transactions: (purchases.data ?? []).length,
          blogPostsCreated: (blogPosts.data ?? []).length,
          blogPostsPublished: (blogPosts.data ?? []).filter(
            (p) => p.status === 'published'
          ).length,
          socialPostsCreated: (socialPosts.data ?? []).length,
          emailsSent: (emailsSent.data ?? []).filter(
            (e) => e.status === 'sent'
          ).length,
          supportTicketsCreated: ticketsCreated.count ?? 0,
          supportTicketsResolved: ticketsResolved.count ?? 0,
          activeStudents: new Set(
            (lessonProgress.data ?? []).map((p) => p.user_id)
          ).size,
          lessonsCompleted: (lessonProgress.data ?? []).filter(
            (p) => p.completed
          ).length,
        },
        null,
        2
      )

      // Use Claude to generate the briefing
      const anthropic = new Anthropic()

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: `You are a business analyst. Generate a concise weekly briefing based on these metrics from the past 7 days. Include:
1. Key highlights (what went well)
2. Areas needing attention
3. Actionable recommendations for next week

Metrics:
${metricsBlock}

Write in a professional but approachable tone. Use bullet points. Keep it under 500 words.`,
          },
        ],
      })

      const briefingText =
        message.content[0].type === 'text'
          ? message.content[0].text
          : 'Unable to generate briefing.'

      return {
        success: true,
        data: {
          briefing: briefingText,
          metrics: JSON.parse(metricsBlock),
          generatedAt: new Date().toISOString(),
          periodStart: since,
          periodEnd: new Date().toISOString(),
        },
      }
    },
  },
]
