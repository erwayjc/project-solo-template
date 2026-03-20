// ---------------------------------------------------------------------------
// Support Ticket Tools
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import { getResend } from '@/lib/resend/client'
import { buildSupportReplyEmail } from '@/lib/resend/templates'
import { encrypt } from '@/lib/utils/encryption'
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
        .update(updateFields as unknown as Record<string, never>)
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

  // -----------------------------------------------------------------------
  // configure_inbound_email
  // -----------------------------------------------------------------------
  {
    name: 'configure_inbound_email',
    description:
      'Enable or configure the inbound email support pipeline. When enabled, emails sent to your support address are automatically converted into support tickets and (optionally) auto-replied to by the CS agent. Automatically registers a Resend webhook if one is not already configured. Returns the current configuration after applying changes, plus setup instructions for any remaining manual steps (typically just DNS records).',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Whether inbound email processing is active.',
        },
        agent_slug: {
          type: 'string',
          description:
            'Slug of the agent that handles inbound emails (e.g. "customer-success", "dev-agent"). Defaults to "customer-success".',
        },
        auto_reply: {
          type: 'boolean',
          description:
            'If true, the CS agent automatically drafts and sends a reply to the customer. If false, tickets are created but replies are manual.',
        },
        app_url: {
          type: 'string',
          description:
            'The public URL of the deployed app (e.g. "https://mysite.com"). Required when enabling for the first time so the Resend webhook can be registered automatically. Not needed if a webhook is already configured.',
        },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()

      // 1. Load current config
      const { data: config, error: loadErr } = await supabase
        .from('site_config')
        .select('cs_agent_config, admin_user_id, resend_webhook_secret')
        .eq('id', 1)
        .single()

      if (loadErr) return { success: false, error: loadErr.message }

      const current = (config.cs_agent_config as { enabled: boolean; agent_slug: string; auto_reply: boolean }) ?? {
        enabled: false,
        agent_slug: 'customer-success',
        auto_reply: true,
      }

      // 2. Merge provided fields
      const updated = {
        enabled: params.enabled !== undefined ? (params.enabled as boolean) : current.enabled,
        agent_slug: params.agent_slug !== undefined ? (params.agent_slug as string) : current.agent_slug,
        auto_reply: params.auto_reply !== undefined ? (params.auto_reply as boolean) : current.auto_reply,
      }

      // 3. If enabling, verify the target agent exists
      if (updated.enabled) {
        const { data: agent } = await supabase
          .from('agents')
          .select('id, name')
          .eq('slug', updated.agent_slug)
          .eq('is_active', true)
          .single()

        if (!agent) {
          return {
            success: false,
            error: `Agent "${updated.agent_slug}" not found or inactive. Create/activate the agent first.`,
          }
        }
      }

      // 4. Auto-register Resend webhook if enabling and no secret exists yet
      const hasWebhookSecret = !!(config.resend_webhook_secret || process.env.RESEND_WEBHOOK_SECRET)
      let webhookRegistered = false
      let webhookError: string | undefined

      if (updated.enabled && !hasWebhookSecret) {
        const appUrl = params.app_url as string | undefined
        if (!appUrl) {
          return {
            success: false,
            error: 'app_url is required when enabling inbound email for the first time. Provide the public URL of your deployed app (e.g. "https://mysite.com") so the Resend webhook can be registered automatically.',
          }
        }

        try {
          const resend = getResend()
          const webhookEndpoint = `${appUrl.replace(/\/$/, '')}/api/webhooks/resend`
          const { data: webhookData, error: whErr } = await resend.webhooks.create({
            endpoint: webhookEndpoint,
            events: [
              'email.received',
              'email.delivered',
              'email.opened',
              'email.clicked',
              'email.bounced',
            ],
          })

          if (whErr) {
            webhookError = `Resend webhook registration failed: ${whErr.message}. You can register it manually in the Resend dashboard.`
          } else if (webhookData?.signing_secret) {
            // Encrypt and store the signing secret
            const encryptedSecret = encrypt(webhookData.signing_secret)
            await supabase
              .from('site_config')
              .update({ resend_webhook_secret: encryptedSecret })
              .eq('id', 1)
            webhookRegistered = true
          }
        } catch (err) {
          webhookError = `Resend webhook registration failed: ${err instanceof Error ? err.message : 'Unknown error'}. You can register it manually in the Resend dashboard.`
        }
      }

      // 5. Save cs_agent_config
      const { error: saveErr } = await supabase
        .from('site_config')
        .update({ cs_agent_config: updated as unknown as Json })
        .eq('id', 1)

      if (saveErr) return { success: false, error: saveErr.message }

      // 6. Build setup instructions for anything still needed
      const setupSteps: string[] = []

      if (!config.admin_user_id) {
        setupSteps.push('Set admin_user_id in site_config (needed for agent invocation on inbound emails).')
      }

      if (webhookError) {
        setupSteps.push(webhookError)
      }

      if (!hasWebhookSecret && !webhookRegistered) {
        setupSteps.push(
          'In the Resend dashboard: add a webhook endpoint pointing to your-domain.com/api/webhooks/resend with the "email.received" event enabled.'
        )
      }

      setupSteps.push(
        'In the Resend dashboard: ensure "Receiving" is enabled on your domain. You may also need to add MX DNS records — check Resend\'s domain settings for instructions.'
      )

      return {
        success: true,
        data: {
          config: updated,
          webhookRegistered,
          setupSteps,
          webhookPath: '/api/webhooks/resend',
          summary: updated.enabled
            ? `Inbound email pipeline is ENABLED.${webhookRegistered ? ' Resend webhook registered automatically.' : ''} Emails will create support tickets and ${updated.auto_reply ? 'auto-reply via' : 'be monitored by'} the "${updated.agent_slug}" agent.`
            : 'Inbound email pipeline is DISABLED. Enable it to start processing incoming support emails.',
        },
      }
    },
  },

  // -----------------------------------------------------------------------
  // get_inbound_email_config
  // -----------------------------------------------------------------------
  {
    name: 'get_inbound_email_config',
    description:
      'Check the current inbound email support configuration — whether it is enabled, which agent handles replies, and what setup steps remain.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute() {
      const supabase = createAdminClient()

      const { data: config, error } = await supabase
        .from('site_config')
        .select('cs_agent_config, admin_user_id, resend_webhook_secret')
        .eq('id', 1)
        .single()

      if (error) return { success: false, error: error.message }

      const csConfig = (config.cs_agent_config as { enabled: boolean; agent_slug: string; auto_reply: boolean }) ?? {
        enabled: false,
        agent_slug: 'customer-success',
        auto_reply: true,
      }

      // Check readiness
      const hasWebhookSecret = !!(config.resend_webhook_secret || process.env.RESEND_WEBHOOK_SECRET)
      const issues: string[] = []
      if (!config.admin_user_id) issues.push('admin_user_id not set in site_config')
      if (!hasWebhookSecret) issues.push('Resend webhook secret not configured (run configure_inbound_email with app_url to set up automatically)')

      // Check if target agent exists
      if (csConfig.enabled) {
        const { data: agent } = await supabase
          .from('agents')
          .select('id, name')
          .eq('slug', csConfig.agent_slug)
          .eq('is_active', true)
          .single()

        if (!agent) issues.push(`Agent "${csConfig.agent_slug}" not found or inactive`)
      }

      return {
        success: true,
        data: {
          config: csConfig,
          ready: csConfig.enabled && issues.length === 0,
          issues: issues.length > 0 ? issues : undefined,
          webhookPath: '/api/webhooks/resend',
        },
      }
    },
  },
]
