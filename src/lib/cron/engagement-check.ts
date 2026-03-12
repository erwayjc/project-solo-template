import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'
import { getResend } from '@/lib/resend/client'
import { buildTestimonialRequestEmail } from '@/lib/resend/templates'
import { getSiteUrl } from '@/lib/utils/url'

export async function runEngagementCheck(): Promise<{
  coldLeads: number
  stalledStudents: number
  expiringSubscriptions: number
  testimonialRequestsSent: number
}> {
  const admin = createAdminClient()

  // 1. Cold leads: new leads older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString()
  const { data: coldLeadRows } = await admin
    .from('leads')
    .update({ status: 'cold' })
    .eq('status', 'new')
    .lt('created_at', sevenDaysAgo)
    .select('id')
  const coldLeads = coldLeadRows?.length ?? 0

  // 2. Stalled students: no lesson progress in 14 days
  const fourteenDaysAgo = new Date(
    Date.now() - 14 * 24 * 3600000
  ).toISOString()
  const { data: recentProgress } = await admin
    .from('lesson_progress')
    .select('user_id')
    .or(`created_at.gte.${fourteenDaysAgo},completed_at.gte.${fourteenDaysAgo}`)

  const activeStudentIds = new Set(
    (recentProgress ?? []).map((p) => p.user_id)
  )

  const { data: allStudents } = await admin
    .from('lesson_progress')
    .select('user_id')

  const allStudentIds = new Set((allStudents ?? []).map((p) => p.user_id))

  const stalledStudents = [...allStudentIds].filter(
    (id) => !activeStudentIds.has(id)
  ).length

  // 3. Expiring subscriptions: within 7 days
  let expiringSubscriptions = 0
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe()
      const sevenDaysFromNow = Math.floor(Date.now() / 1000) + 7 * 24 * 3600

      let subsChecked = 0
      for await (const sub of stripe.subscriptions.list({
        status: 'active',
        limit: 100,
      })) {
        if (++subsChecked > 500) break
        const periodEnd = (sub as unknown as { current_period_end: number }).current_period_end
        if (periodEnd && periodEnd <= sevenDaysFromNow) {
          expiringSubscriptions++
        }
      }
    } catch (err) {
      console.error('Failed to check Stripe subscriptions:', err)
    }
  }

  // 4. Testimonial milestone check
  let testimonialRequestsSent = 0
  try {
    const { data: allLessons } = await admin
      .from('lessons')
      .select('id, module_id')
      .eq('is_published', true)

    if (allLessons && allLessons.length > 0) {
      const lessonsByModule: Record<string, string[]> = {}
      const allLessonIds: string[] = []
      for (const lesson of allLessons) {
        if (!lessonsByModule[lesson.module_id]) {
          lessonsByModule[lesson.module_id] = []
        }
        lessonsByModule[lesson.module_id].push(lesson.id)
        allLessonIds.push(lesson.id)
      }

      const { data: completedProgress } = await admin
        .from('lesson_progress')
        .select('user_id, lesson_id')
        .eq('completed', true)
        .in('lesson_id', allLessonIds)

      if (completedProgress && completedProgress.length > 0) {
        const userCompletions: Record<string, Set<string>> = {}
        for (const p of completedProgress) {
          if (!userCompletions[p.user_id]) {
            userCompletions[p.user_id] = new Set()
          }
          userCompletions[p.user_id].add(p.lesson_id)
        }

        const qualifiedUserIds: string[] = []
        for (const [userId, completedSet] of Object.entries(userCompletions)) {
          for (const [, moduleLessons] of Object.entries(lessonsByModule)) {
            const completedCount = moduleLessons.filter((id) =>
              completedSet.has(id)
            ).length
            if (completedCount >= moduleLessons.length * 0.5) {
              qualifiedUserIds.push(userId)
              break
            }
          }
        }

        if (qualifiedUserIds.length > 0) {
          const { data: existingRequests } = await admin
            .from('testimonial_requests')
            .select('user_id')
            .in('user_id', qualifiedUserIds)

          const alreadyRequested = new Set(
            (existingRequests ?? []).map((r) => r.user_id)
          )
          const newUserIds = qualifiedUserIds
            .filter((id) => !alreadyRequested.has(id))
            .slice(0, 10)

          const { data: siteConfig } = await admin
            .from('site_config')
            .select('site_name, legal_contact_email')
            .eq('id', 1)
            .single()

          const siteName = (siteConfig?.site_name as string) || 'Our Platform'
          const fromEmail =
            (siteConfig?.legal_contact_email as string) || 'noreply@example.com'
          const portalUrl = `${getSiteUrl()}/portal`

          for (const userId of newUserIds) {
            await admin.from('testimonial_requests').insert({
              user_id: userId,
              trigger_type: 'course_milestone',
              status: 'pending',
              sent_at: new Date().toISOString(),
            })

            const { data: userProfile } = await admin
              .from('profiles')
              .select('email, full_name')
              .eq('id', userId)
              .single()

            if (userProfile?.email) {
              const { subject, html } = buildTestimonialRequestEmail(
                userProfile.full_name || 'there',
                siteName,
                portalUrl
              )

              try {
                await getResend().emails.send({
                  from: `${siteName} <${fromEmail}>`,
                  to: userProfile.email,
                  subject,
                  html,
                })
              } catch (emailErr) {
                console.error(
                  `Failed to send testimonial request email to ${userProfile.email}:`,
                  emailErr
                )
              }
            }

            testimonialRequestsSent++
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to process testimonial requests:', err)
  }

  // Create announcement if any findings
  const findings: string[] = []
  if (coldLeads > 0) findings.push(`${coldLeads} cold leads`)
  if (stalledStudents > 0) findings.push(`${stalledStudents} stalled students`)
  if (expiringSubscriptions > 0)
    findings.push(`${expiringSubscriptions} expiring subscriptions`)
  if (testimonialRequestsSent > 0)
    findings.push(`${testimonialRequestsSent} testimonial requests sent`)

  if (findings.length > 0) {
    await admin.from('announcements').insert({
      title: 'Engagement Check',
      content: `Daily check found: ${findings.join(', ')}.`,
      type: 'info',
      is_published: true,
      published_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
    })
  }

  return { coldLeads, stalledStudents, expiringSubscriptions, testimonialRequestsSent }
}
