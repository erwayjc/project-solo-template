// ---------------------------------------------------------------------------
// Progressive Web App (PWA) Tools
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // send_push_notification
  // -----------------------------------------------------------------------
  {
    name: 'send_push_notification',
    description:
      'Send a push notification to users who have enabled notifications via the PWA. Can target all users or a specific segment.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Notification title.' },
        body: { type: 'string', description: 'Notification body text.' },
        segment: {
          type: 'string',
          enum: ['all', 'customers', 'students', 'leads'],
          description: 'Audience segment to target (default "all").',
        },
      },
      required: ['title', 'body'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const segment = (params.segment as string) ?? 'all'

      // Fetch push subscriptions from profiles with active subscriptions
      let query = supabase
        .from('profiles')
        .select('id, push_subscription')
        .not('push_subscription', 'is', null)

      // Segment filtering based on profile type/status
      if (segment === 'customers') {
        // Get IDs of users who have purchases
        const { data: purchases } = await supabase
          .from('purchases')
          .select('user_id')

        const customerIds = [...new Set((purchases ?? []).map((p) => p.user_id as string))]
        if (customerIds.length > 0) {
          query = query.in('id', customerIds)
        } else {
          return { success: true, data: { sent: 0, message: 'No customers with push subscriptions.' } }
        }
      }

      const { data: subscribers, error } = await query

      if (error) return { success: false, error: error.message }
      if (!subscribers || subscribers.length === 0) {
        return { success: true, data: { sent: 0, message: 'No push subscribers found for this segment.' } }
      }

      // In a production deployment, this would call a Web Push service
      // (e.g. web-push library or a push notification service).
      // For now, we record the notification intent and log it.
      const notification = {
        title: params.title,
        body: params.body,
        segment,
        subscriber_count: subscribers.length,
        sent_at: new Date().toISOString(),
      }

      // Store notification record (using announcements table with a pwa type)
      const { error: insertErr } = await supabase.from('announcements').insert({
        title: params.title as string,
        content: params.body as string,
        type: 'info',
        is_published: false,
      })

      if (insertErr) {
        console.error('[send_push_notification] Record insert error:', insertErr.message)
      }

      return {
        success: true,
        data: {
          ...notification,
          note: 'Push notifications recorded. Connect a Web Push provider (e.g. web-push, OneSignal) for actual delivery.',
        },
      }
    },
  },

  // -----------------------------------------------------------------------
  // get_pwa_stats
  // -----------------------------------------------------------------------
  {
    name: 'get_pwa_stats',
    description:
      'Get PWA installation and engagement statistics, including push subscription counts and install prompts.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute() {
      const supabase = createAdminClient()

      // Count push subscribers
      const { count: pushSubscribers } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .not('push_subscription', 'is', null)

      // Count total profiles (proxy for installs)
      const { count: totalProfiles } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })

      // Get recent push notification history
      const { data: recentNotifications } = await supabase
        .from('announcements')
        .select('title, created_at')
        .eq('type', 'push_notification')
        .order('created_at', { ascending: false })
        .limit(10)

      return {
        success: true,
        data: {
          pushSubscribers: pushSubscribers ?? 0,
          totalProfiles: totalProfiles ?? 0,
          subscriptionRate:
            totalProfiles && totalProfiles > 0
              ? Math.round(((pushSubscribers ?? 0) / totalProfiles) * 100 * 100) / 100
              : 0,
          recentNotifications: recentNotifications ?? [],
        },
      }
    },
  },

  // -----------------------------------------------------------------------
  // update_pwa_config
  // -----------------------------------------------------------------------
  {
    name: 'update_pwa_config',
    description:
      'Update PWA configuration stored in site_config, such as theme color, app name, display mode, and icon URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        updates: {
          type: 'object',
          description:
            'PWA config fields. Keys: pwa_name, pwa_short_name, pwa_theme_color, pwa_background_color, pwa_display, pwa_icon_192, pwa_icon_512.',
        },
      },
      required: ['updates'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const updates = params.updates as Record<string, unknown>

      // PWA config is stored within the site_config row
      const { data: config, error: cErr } = await supabase
        .from('site_config')
        .select('*')
        .eq('id', 1)
        .single()

      if (cErr) return { success: false, error: cErr.message }

      const existingPwa = ((config as unknown as Record<string, unknown>).pwa_config as Record<string, unknown>) ?? {}
      const mergedPwa = { ...existingPwa, ...updates }

      const { error } = await supabase
        .from('site_config')
        .update({
          pwa_config: mergedPwa,
        } as unknown as Record<string, never>)
        .eq('id', 1)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data: { pwa_config: mergedPwa } }
    },
  },
]
