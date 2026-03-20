import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
    subscriptions: {
      list: vi.fn(),
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
}))

vi.mock('@/lib/utils/url', () => ({
  getSiteUrl: vi.fn().mockReturnValue('http://localhost:3000'),
}))

import {
  createCheckoutSession,
  getSubscriptions,
  createCustomerPortalSession,
} from '@/actions/stripe'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'

// Helper to build a mock Supabase client
function mockSupabase({
  user = null,
  profile = null,
}: {
  user?: { id: string; email: string } | null
  profile?: { stripe_customer_id: string | null; role?: string } | null
}) {
  const single = vi.fn().mockResolvedValue({ data: profile, error: null })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    from,
  }

  vi.mocked(createClient).mockResolvedValue(client as never)
  return client
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

describe('createCheckoutSession', () => {
  it('creates checkout session with provided email', async () => {
    mockSupabase({ user: null })
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      url: 'https://checkout.stripe.com/session_123',
    } as never)

    const result = await createCheckoutSession('price_1', 'test@example.com')

    expect(result).toEqual({ url: 'https://checkout.stripe.com/session_123' })
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: 'test@example.com',
        line_items: [{ price: 'price_1', quantity: 1 }],
      })
    )
  })

  it("uses authenticated user's email when none provided", async () => {
    mockSupabase({
      user: { id: 'user_1', email: 'user@example.com' },
      profile: { stripe_customer_id: null },
    })
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      url: 'https://checkout.stripe.com/session_123',
    } as never)

    await createCheckoutSession('price_1')

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: 'user@example.com',
      })
    )
  })

  it('throws when no email available', async () => {
    mockSupabase({ user: null })

    await expect(createCheckoutSession('price_1')).rejects.toThrow(
      'Customer email is required'
    )
  })

  it('uses existing Stripe customer ID from profile', async () => {
    mockSupabase({
      user: { id: 'user_1', email: 'user@example.com' },
      profile: { stripe_customer_id: 'cus_existing' },
    })
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      url: 'https://checkout.stripe.com/session_123',
    } as never)

    await createCheckoutSession('price_1')

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_existing',
      })
    )
    // Should not set customer_email when customer ID is used
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        customer_email: expect.anything(),
      })
    )
  })

  it('validates successUrl is same-origin (throws for external URL)', async () => {
    mockSupabase({
      user: { id: 'user_1', email: 'user@example.com' },
      profile: { stripe_customer_id: null },
    })

    await expect(
      createCheckoutSession(
        'price_1',
        undefined,
        'https://evil.com/steal-session'
      )
    ).rejects.toThrow('successUrl must be on the same origin')
  })

  it('validates cancelUrl is same-origin', async () => {
    mockSupabase({
      user: { id: 'user_1', email: 'user@example.com' },
      profile: { stripe_customer_id: null },
    })

    await expect(
      createCheckoutSession(
        'price_1',
        undefined,
        undefined,
        'https://evil.com/phishing'
      )
    ).rejects.toThrow('cancelUrl must be on the same origin')
  })

  it('uses default success/cancel URLs when not provided', async () => {
    mockSupabase({
      user: { id: 'user_1', email: 'user@example.com' },
      profile: { stripe_customer_id: null },
    })
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      url: 'https://checkout.stripe.com/session_123',
    } as never)

    await createCheckoutSession('price_1')

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url:
          'http://localhost:3000/purchase/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3000/purchase/cancel',
      })
    )
  })

  it('throws when Stripe returns no URL', async () => {
    mockSupabase({
      user: { id: 'user_1', email: 'user@example.com' },
      profile: { stripe_customer_id: null },
    })
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      url: null,
    } as never)

    await expect(createCheckoutSession('price_1')).rejects.toThrow(
      'Failed to create checkout session URL'
    )
  })
})

describe('getSubscriptions', () => {
  const mockSubscriptionData = {
    data: [
      {
        id: 'sub_1',
        status: 'active',
        items: {
          data: [
            {
              current_period_end: 1234567890,
              price: {
                id: 'price_1',
                product: 'prod_1',
              },
            },
          ],
        },
      },
    ],
  }

  it('returns subscriptions for authenticated user', async () => {
    mockSupabase({
      user: { id: 'user_1', email: 'user@example.com' },
      profile: { stripe_customer_id: 'cus_1', role: 'customer' },
    })
    vi.mocked(stripe.subscriptions.list).mockResolvedValue(
      mockSubscriptionData as never
    )

    const result = await getSubscriptions('cus_1')

    expect(result.subscriptions).toHaveLength(1)
    expect(result.subscriptions[0]).toEqual({
      id: 'sub_1',
      status: 'active',
      currentPeriodEnd: new Date(1234567890 * 1000).toISOString(),
      priceId: 'price_1',
      productId: 'prod_1',
    })
    expect(stripe.subscriptions.list).toHaveBeenCalledWith({
      customer: 'cus_1',
      status: 'all',
      expand: ['data.items.data.price.product'],
    })
  })

  it('throws when not authenticated', async () => {
    mockSupabase({ user: null })

    await expect(getSubscriptions('cus_1')).rejects.toThrow(
      'Authentication required'
    )
  })

  it("throws when customerId doesn't belong to user (IDOR check)", async () => {
    mockSupabase({
      user: { id: 'user_1', email: 'user@example.com' },
      profile: { stripe_customer_id: 'cus_own', role: 'customer' },
    })

    await expect(getSubscriptions('cus_other')).rejects.toThrow(
      'Access denied: customer ID does not belong to you'
    )
  })

  it("admin can access any customer's subscriptions", async () => {
    mockSupabase({
      user: { id: 'admin_1', email: 'admin@example.com' },
      profile: { stripe_customer_id: 'cus_admin', role: 'admin' },
    })
    vi.mocked(stripe.subscriptions.list).mockResolvedValue(
      mockSubscriptionData as never
    )

    const result = await getSubscriptions('cus_other')

    expect(result.subscriptions).toHaveLength(1)
    expect(stripe.subscriptions.list).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_other' })
    )
  })
})

describe('createCustomerPortalSession', () => {
  it('creates portal session successfully', async () => {
    mockSupabase({
      user: { id: 'user_1', email: 'user@example.com' },
      profile: { stripe_customer_id: 'cus_1', role: 'customer' },
    })
    vi.mocked(stripe.billingPortal.sessions.create).mockResolvedValue({
      url: 'https://billing.stripe.com/session_123',
    } as never)

    const result = await createCustomerPortalSession('cus_1')

    expect(result).toEqual({
      url: 'https://billing.stripe.com/session_123',
    })
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_1',
      return_url: 'http://localhost:3000/portal/billing',
    })
  })

  it("throws when customerId doesn't belong to user", async () => {
    mockSupabase({
      user: { id: 'user_1', email: 'user@example.com' },
      profile: { stripe_customer_id: 'cus_own', role: 'customer' },
    })

    await expect(createCustomerPortalSession('cus_other')).rejects.toThrow(
      'Access denied: customer ID does not belong to you'
    )
  })

  it('admin can create portal session for any customer', async () => {
    mockSupabase({
      user: { id: 'admin_1', email: 'admin@example.com' },
      profile: { stripe_customer_id: 'cus_admin', role: 'admin' },
    })
    vi.mocked(stripe.billingPortal.sessions.create).mockResolvedValue({
      url: 'https://billing.stripe.com/session_123',
    } as never)

    const result = await createCustomerPortalSession('cus_other')

    expect(result).toEqual({
      url: 'https://billing.stripe.com/session_123',
    })
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_other',
      return_url: 'http://localhost:3000/portal/billing',
    })
  })
})
