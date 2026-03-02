// ---------------------------------------------------------------------------
// Email Marketing Tools
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend/client'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // create_email_sequence
  // -----------------------------------------------------------------------
  {
    name: 'create_email_sequence',
    description:
      'Create an automated email sequence with multiple steps. Each step has a subject, body (HTML or plain text), and a delay in hours from the previous step (or from enrollment for the first step).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Internal name for the sequence.' },
        trigger: {
          type: 'string',
          description:
            'What triggers enrollment. Examples: "lead_signup", "purchase", "tag:vip", "manual".',
        },
        steps: {
          type: 'array',
          description: 'Ordered list of email steps.',
          items: {
            type: 'object',
            properties: {
              subject: { type: 'string' },
              body: { type: 'string', description: 'Email body (HTML supported).' },
              delay_hours: {
                type: 'number',
                description: 'Hours to wait before sending (0 = immediate).',
              },
            },
            required: ['subject', 'body', 'delay_hours'],
          },
        },
      },
      required: ['name', 'trigger', 'steps'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const steps = params.steps as Array<{
        subject: string
        body: string
        delay_hours: number
      }>

      // Create the sequence record
      const { data: sequence, error: seqError } = await supabase
        .from('email_sequences')
        .insert({
          name: params.name as string,
          trigger: (params.trigger as string) ?? 'manual',
          is_active: false,
        })
        .select()
        .single()

      if (seqError) return { success: false, error: seqError.message }

      // Insert steps
      const seqId = (sequence as Record<string, unknown>).id as string
      const stepRecords = steps.map((step, index) => ({
        sequence_id: seqId,
        step_number: index,
        subject: step.subject,
        body: step.body,
        delay_hours: step.delay_hours,
      }))

      const { error: stepsError } = await supabase
        .from('email_sequence_steps')
        .insert(stepRecords)

      if (stepsError) return { success: false, error: stepsError.message }

      return {
        success: true,
        data: { ...(sequence as Record<string, unknown>), stepCount: steps.length },
      }
    },
  },

  // -----------------------------------------------------------------------
  // update_email_sequence
  // -----------------------------------------------------------------------
  {
    name: 'update_email_sequence',
    description:
      'Update an email sequence metadata or its steps. To update steps, pass a "steps" array which will replace all existing steps.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Sequence UUID.' },
        updates: {
          type: 'object',
          description: 'Fields to update.',
          properties: {
            name: { type: 'string' },
            trigger: { type: 'string' },
            is_active: { type: 'boolean' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  subject: { type: 'string' },
                  body: { type: 'string' },
                  delay_hours: { type: 'number' },
                },
                required: ['subject', 'body', 'delay_hours'],
              },
            },
          },
        },
      },
      required: ['id', 'updates'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const id = params.id as string
      const updates = params.updates as Record<string, unknown>
      const newSteps = updates.steps as
        | Array<{ subject: string; body: string; delay_hours: number }>
        | undefined

      // Update sequence metadata (excluding steps)
      const metaUpdates: Record<string, unknown> = {}
      if (updates.name !== undefined) metaUpdates.name = updates.name
      if (updates.trigger !== undefined) metaUpdates.trigger = updates.trigger
      if (updates.is_active !== undefined) metaUpdates.is_active = updates.is_active

      const { data: sequence, error: seqError } = await supabase
        .from('email_sequences')
        .update(metaUpdates as any)
        .eq('id', id)
        .select()
        .single()

      if (seqError) return { success: false, error: seqError.message }

      // Replace steps if provided
      if (newSteps) {
        await supabase.from('email_sequence_steps').delete().eq('sequence_id', id)

        const stepRecords = newSteps.map((step, index) => ({
          sequence_id: id,
          step_number: index,
          subject: step.subject,
          body: step.body,
          delay_hours: step.delay_hours,
        }))

        const { error: stepsError } = await supabase
          .from('email_sequence_steps')
          .insert(stepRecords)

        if (stepsError) return { success: false, error: stepsError.message }
      }

      return { success: true, data: sequence }
    },
  },

  // -----------------------------------------------------------------------
  // create_broadcast
  // -----------------------------------------------------------------------
  {
    name: 'create_broadcast',
    description:
      'Create a one-time email broadcast. The broadcast is created in "draft" status and must be sent separately with send_broadcast.',
    inputSchema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Email subject line.' },
        body: { type: 'string', description: 'Email body (HTML supported).' },
        audience_filter: {
          type: 'object',
          description:
            'Optional filter to target a subset of leads. Keys: status, tags, source.',
        },
        scheduled_for: {
          type: 'string',
          description: 'ISO 8601 timestamp to schedule the send. Omit for manual send.',
        },
      },
      required: ['subject', 'body'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('broadcasts')
        .insert({
          subject: params.subject as string,
          body: params.body as string,
          audience_filter: (params.audience_filter ?? null) as import('@/lib/supabase/types').Json,
          scheduled_for: (params.scheduled_for as string) ?? null,
          status: 'draft',
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // send_broadcast
  // -----------------------------------------------------------------------
  {
    name: 'send_broadcast',
    description:
      'Send a previously created broadcast immediately. Resolves the audience, sends via Resend, and records delivery stats.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Broadcast UUID to send.' },
      },
      required: ['id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const id = params.id as string

      // Load the broadcast
      const { data: broadcast, error: bErr } = await supabase
        .from('broadcasts')
        .select('*')
        .eq('id', id)
        .single()

      if (bErr) return { success: false, error: bErr.message }
      if (broadcast.status === 'sent') {
        return { success: false, error: 'Broadcast has already been sent.' }
      }

      // Build audience query
      let query = supabase.from('leads').select('id, email')
      const filter = broadcast.audience_filter as Record<string, unknown> | null
      if (filter) {
        if (filter.status) query = query.eq('status', filter.status as string)
        if (filter.source) query = query.eq('source', filter.source as string)
        if (filter.tags) query = query.contains('tags', filter.tags as string[])
      }

      const { data: recipients, error: rErr } = await query
      if (rErr) return { success: false, error: rErr.message }
      if (!recipients || recipients.length === 0) {
        return { success: false, error: 'No recipients matched the audience filter.' }
      }

      const fromAddress = process.env.EMAIL_FROM ?? 'hello@example.com'

      // Send emails in batches via Resend
      let sentCount = 0
      let failCount = 0
      const batchSize = 50

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize)
        const promises = batch.map(async (recipient) => {
          try {
            await resend.emails.send({
              from: fromAddress,
              to: recipient.email as string,
              subject: broadcast.subject as string,
              html: broadcast.body as string,
            })

            await supabase.from('email_sends').insert({
              recipient_email: recipient.email as string,
              status: 'sent',
              sent_at: new Date().toISOString(),
            })

            sentCount++
          } catch {
            failCount++
            await supabase.from('email_sends').insert({
              recipient_email: recipient.email as string,
              status: 'bounced',
              sent_at: new Date().toISOString(),
            })
          }
        })

        await Promise.all(promises)
      }

      // Update broadcast status
      await supabase
        .from('broadcasts')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          stats: { sent: sentCount, delivered: 0, opened: 0, clicked: 0, bounced: failCount },
        })
        .eq('id', id)

      return {
        success: true,
        data: {
          broadcastId: id,
          totalRecipients: recipients.length,
          sent: sentCount,
          failed: failCount,
        },
      }
    },
  },

  // -----------------------------------------------------------------------
  // get_email_stats
  // -----------------------------------------------------------------------
  {
    name: 'get_email_stats',
    description:
      'Get email delivery statistics for a specific sequence or broadcast, or an overview of all email activity.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['sequence', 'broadcast'],
          description: 'Whether to get stats for sequences or broadcasts.',
        },
        id: {
          type: 'string',
          description: 'Optional specific sequence or broadcast UUID. Omit for aggregate stats.',
        },
      },
      required: ['type'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const statsType = params.type as 'sequence' | 'broadcast'
      const id = params.id as string | undefined

      if (statsType === 'broadcast') {
        if (id) {
          const { data: broadcast, error } = await supabase
            .from('broadcasts')
            .select('*')
            .eq('id', id)
            .single()

          if (error) return { success: false, error: error.message }

          const { count: sentCount } = await supabase
            .from('email_sends')
            .select('*', { count: 'exact', head: true })
            .eq('broadcast_id', id)
            .eq('status', 'sent')

          const { count: failedCount } = await supabase
            .from('email_sends')
            .select('*', { count: 'exact', head: true })
            .eq('broadcast_id', id)
            .eq('status', 'failed')

          return {
            success: true,
            data: {
              broadcast,
              sent: sentCount ?? 0,
              failed: failedCount ?? 0,
            },
          }
        }

        // Aggregate broadcast stats
        const { data: broadcasts, error } = await supabase
          .from('broadcasts')
          .select('id, subject, status, stats, sent_at, created_at')
          .order('created_at', { ascending: false })
          .limit(20)

        if (error) return { success: false, error: error.message }
        return { success: true, data: { broadcasts } }
      }

      // Sequence stats
      if (id) {
        const { data: sequence, error } = await supabase
          .from('email_sequences')
          .select('*')
          .eq('id', id)
          .single()

        if (error) return { success: false, error: error.message }

        const { data: steps } = await supabase
          .from('email_sequence_steps')
          .select('*')
          .eq('sequence_id', id)
          .order('step_order', { ascending: true })

        const { count: enrollmentCount } = await supabase
          .from('sequence_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('sequence_id', id)

        return {
          success: true,
          data: {
            sequence,
            steps,
            enrollments: enrollmentCount ?? 0,
          },
        }
      }

      // Aggregate sequence stats
      const { data: sequences, error } = await supabase
        .from('email_sequences')
        .select('id, name, trigger, is_active, created_at')
        .order('created_at', { ascending: false })

      if (error) return { success: false, error: error.message }
      return { success: true, data: { sequences } }
    },
  },
]
