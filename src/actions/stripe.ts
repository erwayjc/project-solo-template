'use server'

import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { getSiteUrl } from '@/lib/utils/url'

/**
 * Create a Stripe Checkout Session for a given price.
 */
export async function createCheckoutSession(
  priceId: string,
  customerEmail?: string,
  successUrl?: string,
  cancelUrl?: string
): Promise<{ url: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Use the authenticated user's email if no email is provided
  const email = customerEmail || user?.email

  if (!email) {
    throw new Error('Customer email is required')
  }

  const baseUrl = getSiteUrl()

  // Validate custom URLs are same-origin to prevent open redirect
  if (successUrl && !successUrl.startsWith(baseUrl)) {
    throw new Error('successUrl must be on the same origin')
  }
  if (cancelUrl && !cancelUrl.startsWith(baseUrl)) {
    throw new Error('cancelUrl must be on the same origin')
  }

  // If the user is authenticated, check for an existing Stripe customer ID
  let customerId: string | undefined
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id as string
    }
  }

  const sessionParams: Record<string, unknown> = {
    mode: 'payment' as const,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl || `${baseUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${baseUrl}/purchase/cancel`,
    metadata: {
      user_id: user?.id || '',
    },
  }

  if (customerId) {
    sessionParams.customer = customerId
  } else {
    sessionParams.customer_email = email
  }

  const session = await stripe.checkout.sessions.create(
    sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
  )

  if (!session.url) {
    throw new Error('Failed to create checkout session URL')
  }

  return { url: session.url }
}

/**
 * Get all subscriptions for a Stripe customer.
 * Verifies the customerId belongs to the authenticated user.
 */
export async function getSubscriptions(
  customerId: string
): Promise<{
  subscriptions: Array<{
    id: string
    status: string
    currentPeriodEnd: string
    priceId: string
    productId: string
  }>
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  // Verify the customerId belongs to the authenticated user
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.stripe_customer_id !== customerId) {
    throw new Error('Access denied: customer ID does not belong to you')
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    expand: ['data.items.data.price.product'],
  })

  return {
    subscriptions: subscriptions.data.map((sub) => {
      const item = sub.items.data[0]
      return {
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: item?.current_period_end
          ? new Date(item.current_period_end * 1000).toISOString()
          : '',
        priceId: item?.price?.id || '',
        productId:
          typeof item?.price?.product === 'string'
            ? item.price.product
            : (item?.price?.product as { id: string })?.id || '',
      }
    }),
  }
}

/**
 * Create a Stripe Customer Portal session for managing subscriptions.
 * Verifies the customerId belongs to the authenticated user.
 */
export async function createCustomerPortalSession(
  customerId: string
): Promise<{ url: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  // Verify the customerId belongs to the authenticated user
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.stripe_customer_id !== customerId) {
    throw new Error('Access denied: customer ID does not belong to you')
  }

  const baseUrl = getSiteUrl()

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/portal/billing`,
  })

  return { url: session.url }
}
