import type Stripe from 'stripe'
import { stripe } from './client'

/**
 * Verify a Stripe webhook signature and return the parsed event.
 * Throws if the signature is invalid.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required')
  }

  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
}
