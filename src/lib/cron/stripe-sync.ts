import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'

export async function syncStripeData(): Promise<{
  productsChecked: number
  updated: number
  subscriptionsChecked: number
}> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { productsChecked: 0, updated: 0, subscriptionsChecked: 0 }
  }

  const stripe = getStripe()
  const admin = createAdminClient()
  let productsChecked = 0
  let updated = 0
  let subscriptionsChecked = 0

  // 1. Sync products and prices
  const products: Array<{
    id: string
    name: string
    description: string | null
    defaultPriceId: string | null
  }> = []

  for await (const product of stripe.products.list({ active: true, limit: 100 })) {
    if (productsChecked >= 500) break
    products.push({
      id: product.id,
      name: product.name,
      description: product.description,
      defaultPriceId:
        typeof product.default_price === 'string'
          ? product.default_price
          : product.default_price?.id || null,
    })
    productsChecked++
  }

  for (const product of products) {
    const { data: existing } = await admin
      .from('products')
      .select('id, name, description')
      .eq('stripe_product_id', product.id)
      .single()

    if (!existing) {
      await admin.from('products').insert({
        name: product.name,
        description: product.description || '',
        stripe_product_id: product.id,
        stripe_price_id: product.defaultPriceId || '',
        is_active: true,
      })
      updated++
    } else if (
      existing.name !== product.name ||
      existing.description !== product.description
    ) {
      await admin
        .from('products')
        .update({
          name: product.name,
          description: product.description || '',
        })
        .eq('id', existing.id)
      updated++
    }
  }

  // 2. Sync subscription statuses
  for (const status of ['past_due', 'canceled'] as const) {
    for await (const sub of stripe.subscriptions.list({
      status,
      limit: 100,
    })) {
      if (subscriptionsChecked >= 500) break
      subscriptionsChecked++

      const dbStatus = status === 'past_due' ? 'expired' : 'cancelled'
      const customerId = typeof sub.customer === 'string' ? sub.customer : null
      if (!customerId) continue
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()
      if (!profile) continue
      await admin
        .from('purchases')
        .update({ status: dbStatus })
        .eq('user_id', profile.id)
        .eq('status', 'active')
    }
  }

  return { productsChecked, updated, subscriptionsChecked }
}
