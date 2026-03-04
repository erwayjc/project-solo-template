'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Authentication required')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Admin access required')
  return user
}

/**
 * Initiate Stripe Connect OAuth flow.
 * Generates a state token for CSRF protection and returns the OAuth URL.
 */
export async function initiateStripeConnect(): Promise<{ url: string }> {
  await requireAdmin()

  const clientId = process.env.STRIPE_CLIENT_ID
  if (!clientId) throw new Error('STRIPE_CLIENT_ID is not configured')

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || 'http://localhost:3000'

  const redirectUri = `${baseUrl}/api/auth/stripe/callback`

  // Generate CSRF state token
  const state = randomBytes(32).toString('hex')

  // Store state in cookie for verification on callback
  const cookieStore = await cookies()
  cookieStore.set('stripe_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    state,
    redirect_uri: redirectUri,
  })

  return {
    url: `https://connect.stripe.com/oauth/authorize?${params.toString()}`,
  }
}

/**
 * Get the current Stripe Connect status.
 */
export async function getStripeConnectStatus(): Promise<{
  connected: boolean
  accountId?: string
}> {
  await requireAdmin()

  const admin = createAdminClient()
  const { data: config } = await admin
    .from('site_config')
    .select('stripe_connect_account_id')
    .eq('id', 1)
    .single()

  const accountId = config?.stripe_connect_account_id
  return {
    connected: !!accountId,
    accountId: accountId ?? undefined,
  }
}
