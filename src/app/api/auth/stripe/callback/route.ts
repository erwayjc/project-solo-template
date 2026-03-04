import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const settingsUrl = new URL('/admin/settings', request.url)
  settingsUrl.hash = 'integrations'

  // Verify the requesting user is an authenticated admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    settingsUrl.searchParams.set('stripe', 'error')
    settingsUrl.searchParams.set('message', 'Authentication required')
    return NextResponse.redirect(settingsUrl)
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') {
    settingsUrl.searchParams.set('stripe', 'error')
    settingsUrl.searchParams.set('message', 'Admin access required')
    return NextResponse.redirect(settingsUrl)
  }

  // Handle OAuth errors
  if (error) {
    settingsUrl.searchParams.set('stripe', 'error')
    settingsUrl.searchParams.set('message', errorDescription || error)
    return NextResponse.redirect(settingsUrl)
  }

  if (!code || !state) {
    settingsUrl.searchParams.set('stripe', 'error')
    settingsUrl.searchParams.set('message', 'Missing authorization code or state')
    return NextResponse.redirect(settingsUrl)
  }

  // Verify CSRF state token
  const cookieStore = await cookies()
  const savedState = cookieStore.get('stripe_oauth_state')?.value

  if (!savedState || savedState !== state) {
    settingsUrl.searchParams.set('stripe', 'error')
    settingsUrl.searchParams.set('message', 'Invalid state parameter — possible CSRF attack')
    return NextResponse.redirect(settingsUrl)
  }

  // Clear the state cookie
  cookieStore.delete('stripe_oauth_state')

  // Exchange authorization code for access token
  try {
    const tokenResponse = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_secret: process.env.STRIPE_SECRET_KEY!,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      settingsUrl.searchParams.set('stripe', 'error')
      settingsUrl.searchParams.set('message', errorData.error_description || 'Token exchange failed')
      return NextResponse.redirect(settingsUrl)
    }

    const tokenData = await tokenResponse.json()
    const stripeUserId = tokenData.stripe_user_id

    if (!stripeUserId) {
      settingsUrl.searchParams.set('stripe', 'error')
      settingsUrl.searchParams.set('message', 'No Stripe account ID returned')
      return NextResponse.redirect(settingsUrl)
    }

    // Store the connected account ID in site_config
    const admin = createAdminClient()
    const { error: dbError } = await admin
      .from('site_config')
      .update({ stripe_connect_account_id: stripeUserId })
      .eq('id', 1)

    if (dbError) {
      settingsUrl.searchParams.set('stripe', 'error')
      settingsUrl.searchParams.set('message', 'Failed to save Stripe connection')
      return NextResponse.redirect(settingsUrl)
    }

    settingsUrl.searchParams.set('stripe', 'connected')
    return NextResponse.redirect(settingsUrl)
  } catch {
    settingsUrl.searchParams.set('stripe', 'error')
    settingsUrl.searchParams.set('message', 'Failed to connect with Stripe')
    return NextResponse.redirect(settingsUrl)
  }
}
