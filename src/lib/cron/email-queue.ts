import { createAdminClient } from '@/lib/supabase/admin'
import { getResend } from '@/lib/resend/client'
import { buildSequenceEmail } from '@/lib/resend/templates'

export async function processEmailQueue(): Promise<{ processed: number; errors: number }> {
  const admin = createAdminClient()
  let processed = 0
  let errors = 0

  const { data: enrollments, error: fetchError } = await admin
    .from('sequence_enrollments')
    .select('*')
    .eq('status', 'active')
    .lte('next_send_at', new Date().toISOString())
    .limit(50)

  if (fetchError) {
    throw new Error(`Failed to fetch enrollments: ${fetchError.message}`)
  }

  if (!enrollments || enrollments.length === 0) {
    return { processed: 0, errors: 0 }
  }

  const { data: siteConfig } = await admin
    .from('site_config')
    .select('site_name, legal_contact_email')
    .eq('id', 1)
    .single()

  const fromName = siteConfig?.site_name || 'My Business'
  const fromEmail = siteConfig?.legal_contact_email
  if (!fromEmail) {
    throw new Error('No sender email configured in site_config')
  }

  const resend = getResend()

  for (const enrollment of enrollments) {
    try {
      const { data: step } = await admin
        .from('email_sequence_steps')
        .select('*')
        .eq('sequence_id', enrollment.sequence_id)
        .eq('step_number', enrollment.current_step)
        .single()

      if (!step) {
        await admin
          .from('sequence_enrollments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id)
        processed++
        continue
      }

      let subscriberName: string | undefined
      const { data: subscriberProfile } = await admin
        .from('profiles')
        .select('full_name')
        .eq('email', enrollment.email)
        .single()
      if (subscriberProfile?.full_name) {
        subscriberName = subscriberProfile.full_name as string
      }

      const { subject, html } = buildSequenceEmail(
        step.subject,
        step.body,
        subscriberName || enrollment.email?.split('@')[0]
      )

      const { data: sendResult } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: enrollment.email,
        subject,
        html,
      })

      await admin.from('email_sends').insert({
        recipient_email: enrollment.email,
        sequence_id: enrollment.sequence_id,
        step_id: step.id,
        resend_id: sendResult?.id || null,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })

      const { data: nextStep } = await admin
        .from('email_sequence_steps')
        .select('delay_hours')
        .eq('sequence_id', enrollment.sequence_id)
        .eq('step_number', enrollment.current_step + 1)
        .single()

      if (nextStep) {
        const nextSendAt = new Date(
          Date.now() + (nextStep.delay_hours as number) * 3600000
        ).toISOString()
        await admin
          .from('sequence_enrollments')
          .update({
            current_step: enrollment.current_step + 1,
            next_send_at: nextSendAt,
            last_sent_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id)
      } else {
        await admin
          .from('sequence_enrollments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            last_sent_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id)
      }

      processed++
    } catch (err) {
      console.error(`Failed to process enrollment ${enrollment.id}:`, err)
      errors++
    }
  }

  return { processed, errors }
}
