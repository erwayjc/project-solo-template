import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the stripe client module before importing
vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}))

import { verifyWebhookSignature } from '@/lib/stripe/webhooks'
import { stripe } from '@/lib/stripe/client'

describe('verifyWebhookSignature', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('calls stripe.webhooks.constructEvent with correct args', () => {
    const mockEvent = { id: 'evt_123', type: 'checkout.session.completed' }
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)

    const result = verifyWebhookSignature('raw-body', 'sig-header')

    expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
      'raw-body',
      'sig-header',
      'whsec_test_secret'
    )
    expect(result).toEqual(mockEvent)
  })

  it('throws when STRIPE_WEBHOOK_SECRET is missing', () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    expect(() => verifyWebhookSignature('body', 'sig')).toThrow(
      'STRIPE_WEBHOOK_SECRET environment variable is required'
    )
  })

  it('propagates errors from constructEvent (invalid signature)', () => {
    vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
      throw new Error('Webhook signature verification failed')
    })

    expect(() => verifyWebhookSignature('body', 'bad-sig')).toThrow(
      'Webhook signature verification failed'
    )
  })
})
