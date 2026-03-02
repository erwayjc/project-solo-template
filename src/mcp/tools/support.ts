// ---------------------------------------------------------------------------
// Support Ticket Tools
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import { getResend } from '@/lib/resend/client'
import { buildSupportReplyEmail } from '@/lib/resend/templates'
import type { ToolDefinition } from '../types'
import type { Json } from '@/lib/supabase/types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // get_support_tickets
  // -----------------------------------------------------------------------
  {
    name: 'get_support_tickets',
    description:
      'Retrieve support tickets with optional status and priority filters.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'in_progress', 'waiting', 'resolved', 'closed'],
          description: 'Filter by ticket status.',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Filter by priority level.',
        },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()

      let query = supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false })

      if (params.status) query = query.eq('status', params.status as string)
      if (params.priority) query = query.eq('priority', params.priority as string)

      const { data, error } = await query

      if (error) return { success: false, error: error.message }
      return { success: true, data: { tickets: data ?? [] } }
    },
  },

  // -----------------------------------------------------------------------
  // respond_to_ticket
  // -----------------------------------------------------------------------
  {
    name: 'respond_to_ticket',
    description:
      'Add a response message to a support ticket. Optionally update the ticket status at the same time.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Ticket UUID.' },
        message: {
          type: 'string',
          description: 'Response message to add to the ticket.',
        },
        new_status: {
          type: 'string',
          enum: ['open', 'in_progress', 'waiting', 'resolved', 'closed'],
          description: 'Optional new status after responding.',
        },
      },
      required: ['id', 'message'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const id = params.id as string

      // Get existing ticket to append to messages
      const { data: ticket, error: tErr } = await supabase
        .from('support_tickets')
        .select('messages, status')
        .eq('id', id)
        .single()

      if (tErr) return { success: false, error: tErr.message }

      const existingMessages = (ticket.messages as Array<Record<string, unknown>>) ?? []
      existingMessages.push({
        role: 'agent',
        content: params.message,
        timestamp: new Date().toISOString(),
      })

      const updateFields: Record<string, unknown> = {
        messages: existingMessages,
      }

      if (params.new_status) {
        updateFields.status = params.new_status
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .update(updateFields as any)
        .eq('id', id)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // resolve_ticket
  // -----------------------------------------------------------------------
  {
    name: 'resolve_ticket',
    description:
      'Mark a support ticket as resolved. Sets the status to "resolved" and records the resolution timestamp.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Ticket UUID to resolve.' },
      },
      required: ['id'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      const { data, error } = await supabase
        .from('support_tickets')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', params.id as string)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // send_customer_email
  // -----------------------------------------------------------------------
  {
    name: 'send_customer_email',
    description:
      'Send an email reply to a customer for a support ticket. Looks up the customer\'s email from the ticket, sends via Resend, and logs the interaction.',
    inputSchema: {
      type: 'object',
      properties: {
        ticket_id: {
          type: 'string',
          description: 'The support ticket UUID to reply to.',
        },
        subject: {
          type: 'string',
          description: 'Email subject line.',
        },
        body: {
          type: 'string',
          description: 'Plain text email body. Will be converted to HTML paragraphs.',
        },
      },
      required: ['ticket_id', 'subject', 'body'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const ticketId = params.ticket_id as string
      const subject = params.subject as string
      const body = params.body as string

      // 1. Load ticket to get customer email / user_id
      const { data: ticket, error: tErr } = await supabase
        .from('support_tickets')
        .select('customer_email, user_id, messages')
        .eq('id', ticketId)
        .single()

      if (tErr) return { success: false, error: tErr.message }

      // 2. Resolve recipient email and name
      let recipientEmail = ticket.customer_email as string | null
      let customerName: string | undefined

      if (ticket.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', ticket.user_id as string)
          .single()

        if (profile) {
          recipientEmail = recipientEmail ?? (profile.email as string | null)
          customerName = (profile.full_name as string) || undefined
        }
      }

      if (!recipientEmail) {
        return { success: false, error: 'No customer email found for this ticket.' }
      }

      // 3. Load site config for sender address and site name
      const { data: config, error: configErr } = await supabase
        .from('site_config')
        .select('site_name, legal_contact_email')
        .eq('id', 1)
        .single()

      if (configErr) return { success: false, error: configErr.message }

      const siteName = (config.site_name as string) || 'Support'
      const senderEmail = config.legal_contact_email as string | null
      if (!senderEmail) {
        return { success: false, error: 'No sender email configured. Set legal_contact_email in site settings.' }
      }

      // 4. Build HTML email
      const emailTemplate = buildSupportReplyEmail(subject, body, siteName, customerName)

      // 5. Send via Resend
      const { data: sendResult, error: sendErr } = await getResend().emails.send({
        from: `${siteName} Support <${senderEmail}>`,
        to: recipientEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      })

      if (sendErr) {
        return { success: false, error: sendErr.message }
      }

      const resendId = sendResult?.id ?? null

      // 6. Log in email_sends
      await supabase.from('email_sends').insert({
        recipient_email: recipientEmail,
        resend_id: resendId,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })

      // 7. Append to ticket messages
      const existingMessages = (ticket.messages as Array<Record<string, unknown>>) ?? []
      existingMessages.push({
        role: 'agent_email',
        content: body,
        timestamp: new Date().toISOString(),
      })

      await supabase
        .from('support_tickets')
        .update({ messages: existingMessages as unknown as Json })
        .eq('id', ticketId)

      return {
        success: true,
        data: { emailId: resendId, recipientEmail },
      }
    },
  },

  // -----------------------------------------------------------------------
  // get_cs_email_stats
  // -----------------------------------------------------------------------
  {
    name: 'get_cs_email_stats',
    description:
      'Get customer service email analytics: inbound counts, response rates, average processing time, status breakdown.',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look back. Defaults to 30.',
        },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()
      const days = (params.days as number) || 30
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      // Use individual count queries instead of loading all rows into memory
      const statuses = ['pending', 'processed', 'escalated', 'failed'] as const

      const countPromises = statuses.map(async (status) => {
        const { count, error } = await supabase
          .from('inbound_emails')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since)
          .eq('agent_response_status', status)
        return { status, count: count ?? 0, error }
      })

      const countResults = await Promise.all(countPromises)
      const firstError = countResults.find((r) => r.error)
      if (firstError?.error) return { success: false, error: firstError.error.message }

      const byStatus: Record<string, number> = {}
      let total = 0
      for (const r of countResults) {
        byStatus[r.status] = r.count
        total += r.count
      }

      // Get avg processing time for processed emails only
      const { data: processedRows } = await supabase
        .from('inbound_emails')
        .select('created_at, processed_at')
        .gte('created_at', since)
        .eq('agent_response_status', 'processed')
        .not('processed_at', 'is', null)

      let avgProcessingTimeMs: number | null = null
      if (processedRows && processedRows.length > 0) {
        let totalMs = 0
        let count = 0
        for (const row of processedRows) {
          const diff = new Date(row.processed_at as string).getTime() - new Date(row.created_at as string).getTime()
          if (diff > 0) { totalMs += diff; count++ }
        }
        avgProcessingTimeMs = count > 0 ? Math.round(totalMs / count) : null
      }

      return {
        success: true,
        data: {
          total,
          byStatus,
          avgProcessingTimeMs,
          periodDays: days,
        },
      }
    },
  },
]
