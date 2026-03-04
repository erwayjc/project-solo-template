import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/utils/cron'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic } from '@/lib/claude/client'
import { getResend } from '@/lib/resend/client'
import { buildSequenceEmail } from '@/lib/resend/templates'

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Get site config for recipient and site name
  const { data: siteConfig } = await admin
    .from('site_config')
    .select('site_name, legal_contact_email')
    .eq('id', 1)
    .single()

  const recipientEmail = siteConfig?.legal_contact_email
  if (!recipientEmail) {
    return NextResponse.json({ skipped: 'no_recipient' })
  }

  const siteName = siteConfig?.site_name || 'My Business'

  // Gather 7-day metrics in parallel (same as generate_weekly_briefing)
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const since = oneWeekAgo.toISOString()

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
    admin
      .from('leads')
      .select('id', { count: 'exact' })
      .gte('created_at', since),
    admin.from('purchases').select('amount').gte('created_at', since),
    admin
      .from('blog_posts')
      .select('id, status')
      .gte('created_at', since),
    admin
      .from('content_queue')
      .select('id, status')
      .gte('created_at', since),
    admin
      .from('email_sends')
      .select('status')
      .gte('sent_at', since),
    admin
      .from('support_tickets')
      .select('id', { count: 'exact' })
      .gte('created_at', since),
    admin
      .from('support_tickets')
      .select('id', { count: 'exact' })
      .gte('resolved_at', since),
    admin
      .from('lesson_progress')
      .select('user_id, completed')
      .gte('completed_at', since),
  ])

  const weeklyRevenue = (purchases.data ?? []).reduce(
    (sum, p) => sum + ((p.amount as number) ?? 0),
    0
  )

  const metrics = {
    newLeads: newLeads.count ?? 0,
    revenue: weeklyRevenue,
    transactions: (purchases.data ?? []).length,
    blogPostsCreated: (blogPosts.data ?? []).length,
    blogPostsPublished: (blogPosts.data ?? []).filter(
      (p) => p.status === 'published'
    ).length,
    socialPostsCreated: (socialPosts.data ?? []).length,
    emailsSent: (emailsSent.data ?? []).filter((e) => e.status === 'sent')
      .length,
    supportTicketsCreated: ticketsCreated.count ?? 0,
    supportTicketsResolved: ticketsResolved.count ?? 0,
    activeStudents: new Set(
      (lessonProgress.data ?? []).map((p) => p.user_id)
    ).size,
    lessonsCompleted: (lessonProgress.data ?? []).filter((p) => p.completed)
      .length,
  }

  let briefingText: string

  // Generate briefing with Claude if available, otherwise format raw metrics
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = getAnthropic()

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: `You are a business analyst. Generate a concise weekly briefing based on these metrics from the past 7 days. Include:
1. Key highlights (what went well)
2. Areas needing attention
3. Actionable recommendations for next week

Metrics:
${JSON.stringify(metrics, null, 2)}

Write in a professional but approachable tone. Use bullet points. Keep it under 500 words.`,
          },
        ],
      })

      briefingText =
        message.content[0].type === 'text'
          ? message.content[0].text
          : 'Unable to generate briefing.'
    } catch (err) {
      console.error('Failed to generate AI briefing:', err)
      briefingText = formatRawMetrics(metrics)
    }
  } else {
    briefingText = formatRawMetrics(metrics)
  }

  // Send email
  const resend = getResend()
  const subject = `Weekly CEO Briefing — ${siteName}`
  // Escape HTML entities and convert newlines to <br> for safe email rendering
  const safeBriefing = briefingText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  const { html } = buildSequenceEmail(subject, safeBriefing)

  await resend.emails.send({
    from: `${siteName} <noreply@${recipientEmail.split('@')[1]}>`,
    to: recipientEmail,
    subject,
    html,
  })

  return NextResponse.json({ sent: true, recipient: recipientEmail })
}

function formatRawMetrics(metrics: Record<string, number>): string {
  const revenue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(metrics.revenue / 100)

  return `Weekly Business Summary:

- New Leads: ${metrics.newLeads}
- Revenue: ${revenue} (${metrics.transactions} transactions)
- Blog Posts: ${metrics.blogPostsCreated} created, ${metrics.blogPostsPublished} published
- Social Posts: ${metrics.socialPostsCreated} created
- Emails Sent: ${metrics.emailsSent}
- Support Tickets: ${metrics.supportTicketsCreated} created, ${metrics.supportTicketsResolved} resolved
- Active Students: ${metrics.activeStudents}
- Lessons Completed: ${metrics.lessonsCompleted}`
}
