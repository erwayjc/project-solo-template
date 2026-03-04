'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend/client'
import { buildBroadcastEmail } from '@/lib/resend/templates'
import type {
  EmailSequence,
  EmailSequenceStep,
  Broadcast,
} from '@/types/database'
import type { Json } from '@/lib/supabase/types'

// ── Sequences ──

export async function getSequences(): Promise<EmailSequence[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data, error } = await supabase
    .from('email_sequences')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch sequences: ${error.message}`)
  }

  return data as EmailSequence[]
}

export async function createSequence(sequenceData: {
  name: string
  trigger?: string
  is_active?: boolean
}): Promise<EmailSequence> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  const { data, error } = await supabase
    .from('email_sequences')
    .insert(sequenceData)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create sequence: ${error.message}`)
  }

  return data as EmailSequence
}

export async function updateSequence(
  id: string,
  sequenceData: Partial<Omit<EmailSequence, 'id'>>
): Promise<EmailSequence> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  const { data, error } = await supabase
    .from('email_sequences')
    .update(sequenceData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update sequence: ${error.message}`)
  }

  return data as EmailSequence
}

// ── Broadcasts ──

export async function getBroadcasts(): Promise<Broadcast[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data, error } = await supabase
    .from('broadcasts')
    .select('*')
    .order('scheduled_for', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch broadcasts: ${error.message}`)
  }

  return data as Broadcast[]
}

export async function createBroadcast(broadcastData: {
  subject: string
  body: string
  audience_filter?: Record<string, unknown>
  scheduled_for?: string
}): Promise<Broadcast> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  const { data, error } = await supabase
    .from('broadcasts')
    .insert({
      ...broadcastData,
      audience_filter: broadcastData.audience_filter as unknown as Json,
      status: broadcastData.scheduled_for ? 'scheduled' : 'draft',
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create broadcast: ${error.message}`)
  }

  return data as Broadcast
}

export async function sendBroadcast(id: string): Promise<{ sent: number }> {
  const supabase = await createClient()

  // Verify admin
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  // Fetch the broadcast
  const { data: broadcast, error: fetchError } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !broadcast) {
    throw new Error('Broadcast not found')
  }

  // Use admin client to fetch leads (service role bypasses RLS)
  const admin = createAdminClient()

  // Fetch non-unsubscribed leads
  let leadQuery = admin
    .from('leads')
    .select('email, name')
    .eq('unsubscribed', false)

  const { data: leads, error: leadsError } = await leadQuery

  if (leadsError) {
    throw new Error(`Failed to fetch recipients: ${leadsError.message}`)
  }

  // Update broadcast status to sending
  await supabase
    .from('broadcasts')
    .update({ status: 'sending' })
    .eq('id', id)

  // Get site config for sender info
  const { data: siteConfig } = await supabase
    .from('site_config')
    .select('site_name, legal_contact_email')
    .eq('id', 1)
    .single()

  const fromName = (siteConfig?.site_name as string) || 'Newsletter'
  const fromEmail = (siteConfig?.legal_contact_email as string) || 'noreply@example.com'

  let sentCount = 0

  // Send to each recipient
  for (const lead of leads ?? []) {
    try {
      const { subject, html } = buildBroadcastEmail(
        broadcast.subject as string,
        broadcast.body as string,
        lead.name as string | undefined
      )

      await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: lead.email as string,
        subject,
        html,
      })

      // Log the send
      await admin.from('email_sends').insert({
        recipient_email: lead.email,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })

      sentCount++
    } catch {
      // Log failed sends but continue with the rest
      await admin.from('email_sends').insert({
        recipient_email: lead.email,
        status: 'bounced',
      })
    }
  }

  // Update broadcast to sent
  await supabase
    .from('broadcasts')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      stats: { sent: sentCount, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
    })
    .eq('id', id)

  return { sent: sentCount }
}

// ── Stats ──

export async function getEmailStats(): Promise<{
  totalSent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  openRate: number
  clickRate: number
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  // Use count queries instead of loading all rows into memory
  const statusCounts = await Promise.all([
    supabase.from('email_sends').select('*', { count: 'exact', head: true }),
    supabase.from('email_sends').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
    supabase.from('email_sends').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
    supabase.from('email_sends').select('*', { count: 'exact', head: true }).eq('status', 'opened'),
    supabase.from('email_sends').select('*', { count: 'exact', head: true }).eq('status', 'clicked'),
    supabase.from('email_sends').select('*', { count: 'exact', head: true }).eq('status', 'bounced'),
  ])

  const [totalResult, sentResult, deliveredResult, openedResult, clickedResult, bouncedResult] = statusCounts

  if (totalResult.error) {
    throw new Error(`Failed to fetch email stats: ${totalResult.error.message}`)
  }

  const totalSent = totalResult.count ?? 0
  const sent = sentResult.count ?? 0
  const delivered = deliveredResult.count ?? 0
  const opened = openedResult.count ?? 0
  const clicked = clickedResult.count ?? 0
  const bounced = bouncedResult.count ?? 0

  // opened implies delivered, clicked implies opened+delivered
  const totalDelivered = sent + delivered + opened + clicked
  const totalOpened = opened + clicked

  return {
    totalSent,
    delivered: totalDelivered,
    opened: totalOpened,
    clicked,
    bounced,
    openRate: totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0,
    clickRate: totalDelivered > 0 ? Math.round((clicked / totalDelivered) * 100) : 0,
  }
}

// ── Sequence Steps ──

export async function getAllSequenceSteps(): Promise<EmailSequenceStep[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  const { data, error } = await supabase
    .from('email_sequence_steps')
    .select('*')
    .order('step_number', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch all sequence steps: ${error.message}`)
  }

  return data as EmailSequenceStep[]
}

export async function getSequenceSteps(sequenceId: string): Promise<EmailSequenceStep[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  const { data, error } = await supabase
    .from('email_sequence_steps')
    .select('*')
    .eq('sequence_id', sequenceId)
    .order('step_number', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch sequence steps: ${error.message}`)
  }

  return data as EmailSequenceStep[]
}

export async function createSequenceStep(stepData: {
  sequence_id: string
  step_number: number
  subject: string
  body: string
  delay_hours: number
}): Promise<EmailSequenceStep> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  const { data, error } = await supabase
    .from('email_sequence_steps')
    .insert(stepData)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create sequence step: ${error.message}`)
  }

  return data as EmailSequenceStep
}

export async function updateSequenceStep(
  id: string,
  stepData: Partial<{ subject: string; body: string; delay_hours: number }>
): Promise<EmailSequenceStep> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  const { data, error } = await supabase
    .from('email_sequence_steps')
    .update(stepData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update sequence step: ${error.message}`)
  }

  return data as EmailSequenceStep
}

export async function deleteSequenceStep(id: string): Promise<void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  const { error } = await supabase.from('email_sequence_steps').delete().eq('id', id)

  if (error) {
    throw new Error(`Failed to delete sequence step: ${error.message}`)
  }
}

export async function deleteSequence(id: string): Promise<void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  // Delete steps first, then the sequence
  const { error: stepsError } = await supabase
    .from('email_sequence_steps')
    .delete()
    .eq('sequence_id', id)

  if (stepsError) {
    throw new Error(`Failed to delete sequence steps: ${stepsError.message}`)
  }

  const { error } = await supabase.from('email_sequences').delete().eq('id', id)

  if (error) {
    throw new Error(`Failed to delete sequence: ${error.message}`)
  }
}

// ── Extended Broadcasts ──

export async function updateBroadcast(
  id: string,
  broadcastData: Partial<{
    subject: string
    body: string
    audience_filter: Record<string, unknown>
    scheduled_for: string | null
  }>
): Promise<Broadcast> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  // Prevent editing broadcasts that have already been sent
  const { data: existing, error: fetchError } = await supabase
    .from('broadcasts')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    throw new Error('Broadcast not found')
  }

  if (existing.status === 'sent' || existing.status === 'sending') {
    throw new Error('Cannot edit a broadcast that has been sent or is sending')
  }

  const updateData: Record<string, unknown> = { ...broadcastData }
  if (broadcastData.audience_filter !== undefined) {
    updateData.audience_filter = broadcastData.audience_filter as unknown as Json
  }

  const { data, error } = await supabase
    .from('broadcasts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update broadcast: ${error.message}`)
  }

  return data as Broadcast
}

export async function deleteBroadcast(id: string): Promise<void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  // Check broadcast status — only allow deleting draft or scheduled
  const { data: broadcast, error: fetchError } = await supabase
    .from('broadcasts')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchError || !broadcast) {
    throw new Error('Broadcast not found')
  }

  if (broadcast.status === 'sent' || broadcast.status === 'sending') {
    throw new Error('Cannot delete a broadcast that has been sent or is sending')
  }

  const { error } = await supabase.from('broadcasts').delete().eq('id', id)

  if (error) {
    throw new Error(`Failed to delete broadcast: ${error.message}`)
  }
}

export async function getBroadcastRecipientCount(
  audienceFilter?: Record<string, unknown>
): Promise<number> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  let query = supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('unsubscribed', false)

  if (audienceFilter?.status && audienceFilter.status !== 'all') {
    query = query.eq('status', audienceFilter.status as string)
  }

  if (audienceFilter?.source && audienceFilter.source !== 'all') {
    query = query.eq('source', audienceFilter.source as string)
  }

  if (audienceFilter?.tags && Array.isArray(audienceFilter.tags) && audienceFilter.tags.length > 0) {
    query = query.contains('tags', audienceFilter.tags as string[])
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Failed to count recipients: ${error.message}`)
  }

  return count ?? 0
}
