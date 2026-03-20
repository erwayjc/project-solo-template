// ---------------------------------------------------------------------------
// Product Management Tools
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/client'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // create_product
  // -----------------------------------------------------------------------
  {
    name: 'create_product',
    description:
      'Create a new product with a Stripe price. Supports one-time payments and recurring subscriptions. The product is created in both Stripe and the local database.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Product name.' },
        description: { type: 'string', description: 'Product description.' },
        price_amount: {
          type: 'number',
          description: 'Price in the smallest currency unit (e.g. cents for USD). For example, $29.99 = 2999.',
        },
        currency: {
          type: 'string',
          description: 'ISO 4217 currency code (default "usd").',
        },
        price_type: {
          type: 'string',
          enum: ['one_time', 'recurring'],
          description: 'Whether this is a one-time purchase or a subscription.',
        },
        subscription_interval: {
          type: 'string',
          enum: ['month', 'year'],
          description: 'Billing interval for recurring products.',
        },
        features: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of feature bullet points for the product.',
        },
      },
      required: ['name', 'price_amount', 'price_type'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const currency = (params.currency as string) ?? 'usd'
      const priceType = params.price_type as 'one_time' | 'recurring'

      try {
        // Create product in Stripe
        const stripeProduct = await stripe.products.create({
          name: params.name as string,
          description: (params.description as string) ?? undefined,
          metadata: { source: 'project-solo' },
        })

        // Create price in Stripe
        const priceParams: Record<string, unknown> = {
          product: stripeProduct.id,
          unit_amount: params.price_amount as number,
          currency,
        }

        if (priceType === 'recurring') {
          priceParams.recurring = {
            interval: (params.subscription_interval as string) ?? 'month',
          }
        }

        const stripePrice = await stripe.prices.create(
          priceParams as unknown as Parameters<typeof stripe.prices.create>[0]
        )

        // Save to local database
        const { data, error } = await supabase
          .from('products')
          .insert({
            name: params.name as string,
            description: (params.description as string) ?? '',
            stripe_product_id: stripeProduct.id,
            stripe_price_id: stripePrice.id,
            price_amount: params.price_amount as number,
            currency,
            price_type: priceType,
            subscription_interval:
              priceType === 'recurring'
                ? (params.subscription_interval as string) ?? 'month'
                : null,
            features: (params.features as string[]) ?? [],
            is_active: true,
          })
          .select()
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to create product in Stripe',
        }
      }
    },
  },

  // -----------------------------------------------------------------------
  // update_product
  // -----------------------------------------------------------------------
  {
    name: 'update_product',
    description:
      'Update an existing product. Updates are synced to Stripe when applicable (name, description, active status).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Product UUID.' },
        updates: {
          type: 'object',
          description: 'Fields to update.',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            features: { type: 'array', items: { type: 'string' } },
            is_active: { type: 'boolean' },
          },
        },
      },
      required: ['id', 'updates'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const id = params.id as string
      const updates = params.updates as Record<string, unknown>

      // Fetch current product for Stripe sync
      const { data: product, error: pErr } = await supabase
        .from('products')
        .select('stripe_product_id')
        .eq('id', id)
        .single()

      if (pErr) return { success: false, error: pErr.message }

      // Sync relevant fields to Stripe
      const stripeProductId = product.stripe_product_id as string
      if (stripeProductId) {
        try {
          const stripeUpdates: Record<string, unknown> = {}
          if (updates.name !== undefined) stripeUpdates.name = updates.name
          if (updates.description !== undefined) stripeUpdates.description = updates.description
          if (updates.is_active !== undefined) stripeUpdates.active = updates.is_active

          if (Object.keys(stripeUpdates).length > 0) {
            await stripe.products.update(
              stripeProductId,
              stripeUpdates as Parameters<typeof stripe.products.update>[1]
            )
          }
        } catch (err) {
          console.error('[update_product] Stripe sync error:', err)
          // Continue with local update even if Stripe sync fails
        }
      }

      const { data, error } = await supabase
        .from('products')
        .update(updates as unknown as Record<string, never>)
        .eq('id', id)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // get_products
  // -----------------------------------------------------------------------
  {
    name: 'get_products',
    description:
      'List all products. Optionally include sales statistics (total purchases, revenue).',
    inputSchema: {
      type: 'object',
      properties: {
        include_stats: {
          type: 'boolean',
          description: 'If true, includes purchase count and revenue for each product.',
        },
      },
    },
    async execute(params) {
      const supabase = createAdminClient()
      const includeStats = (params.include_stats as boolean) ?? false

      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) return { success: false, error: error.message }

      if (!includeStats) {
        return { success: true, data: { products: products ?? [] } }
      }

      // Attach stats
      const productsWithStats = await Promise.all(
        (products ?? []).map(async (product: Record<string, unknown>) => {
          const { data: purchases } = await supabase
            .from('purchases')
            .select('amount')
            .eq('product_id', product.id as string)

          const totalRevenue = (purchases ?? []).reduce(
            (sum, p: Record<string, unknown>) => sum + ((p.amount as number) ?? 0),
            0
          )

          return {
            ...product,
            stats: {
              totalPurchases: (purchases ?? []).length,
              totalRevenue,
            },
          }
        })
      )

      return { success: true, data: { products: productsWithStats } }
    },
  },
]
