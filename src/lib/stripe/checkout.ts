import { stripe } from './client'
import type Stripe from 'stripe'

interface CreateCheckoutSessionParams {
  priceId: string
  customerEmail: string
  metadata?: Record<string, string>
  successUrl?: string
  cancelUrl?: string
}

export async function createCheckoutSession({
  priceId,
  customerEmail,
  metadata = {},
  successUrl,
  cancelUrl,
}: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    customer_email: customerEmail,
    metadata,
    success_url: successUrl || `${baseUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${baseUrl}/purchase/cancel`,
  })

  return session
}

export async function getCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items', 'customer'],
  })
}
