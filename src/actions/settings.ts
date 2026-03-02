'use server'

import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/utils/encryption'
import type { McpConnection, SiteConfig } from '@/types/database'
import type { BrandColors, HealthCheckResult } from '@/types'
import type { Json } from '@/lib/supabase/types'

/**
 * Get the connection status for all integrated services.
 */
export async function getIntegrationStatus(): Promise<HealthCheckResult[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  const results: HealthCheckResult[] = []

  // Check Supabase (always connected if we got this far)
  results.push({
    service: 'supabase',
    status: 'connected',
    message: 'Database connection active',
  })

  // Check Stripe
  results.push({
    service: 'stripe',
    status: process.env.STRIPE_SECRET_KEY ? 'connected' : 'not_configured',
    message: process.env.STRIPE_SECRET_KEY
      ? 'API key configured'
      : 'STRIPE_SECRET_KEY not set',
  })

  // Check Resend
  results.push({
    service: 'resend',
    status: process.env.RESEND_API_KEY ? 'connected' : 'not_configured',
    message: process.env.RESEND_API_KEY
      ? 'API key configured'
      : 'RESEND_API_KEY not set',
  })

  // Check Anthropic
  results.push({
    service: 'anthropic',
    status: process.env.ANTHROPIC_API_KEY ? 'connected' : 'not_configured',
    message: process.env.ANTHROPIC_API_KEY
      ? 'API key configured'
      : 'ANTHROPIC_API_KEY not set',
  })

  // Check Buffer (optional)
  results.push({
    service: 'buffer',
    status: process.env.BUFFER_ACCESS_TOKEN ? 'connected' : 'not_configured',
    message: process.env.BUFFER_ACCESS_TOKEN
      ? 'Access token configured'
      : 'BUFFER_ACCESS_TOKEN not set (optional)',
  })

  return results
}

/**
 * Update an encrypted integration key (stored in mcp_connections or env).
 * For MCP connections, the key is encrypted and stored in the database.
 */
export async function updateIntegrationKey(
  service: string,
  key: string
): Promise<{ success: boolean }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  // Encrypt the key before storing
  const encryptedKey = encrypt(key)

  // Upsert the MCP connection with the encrypted credential
  const { error } = await supabase
    .from('mcp_connections')
    .upsert(
      {
        slug: service,
        name: service.charAt(0).toUpperCase() + service.slice(1),
        credentials_encrypted: encryptedKey,
        is_active: true,
      },
      { onConflict: 'slug' }
    )

  if (error) {
    throw new Error(`Failed to update integration key: ${error.message}`)
  }

  return { success: true }
}

/**
 * Test the connection for a given service by making a minimal API call.
 */
export async function testConnection(
  service: string
): Promise<HealthCheckResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  try {
    switch (service) {
      case 'stripe': {
        const { stripe } = await import('@/lib/stripe/client')
        await stripe.balance.retrieve()
        return {
          service: 'stripe',
          status: 'connected',
          message: 'Successfully retrieved balance',
        }
      }
      case 'resend': {
        const { resend } = await import('@/lib/resend/client')
        await resend.apiKeys.list()
        return {
          service: 'resend',
          status: 'connected',
          message: 'Successfully listed API keys',
        }
      }
      case 'anthropic': {
        // Test with a minimal call
        const { anthropic } = await import('@/lib/claude/client')
        await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        })
        return {
          service: 'anthropic',
          status: 'connected',
          message: 'Successfully sent test message',
        }
      }
      default:
        return {
          service,
          status: 'error',
          message: `Unknown service: ${service}`,
        }
    }
  } catch (err) {
    return {
      service,
      status: 'error',
      message: err instanceof Error ? err.message : 'Connection failed',
    }
  }
}

/**
 * Update branding (brand_colors, site_name, tagline, logo) in site_config.
 */
export async function updateBranding(data: {
  site_name?: string
  tagline?: string
  logo_url?: string
  brand_colors?: BrandColors
}): Promise<SiteConfig> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  const { data: config, error } = await supabase
    .from('site_config')
    .update({
      ...data,
      brand_colors: data.brand_colors as unknown as Json,
    })
    .eq('id', 1)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update branding: ${error.message}`)
  }

  return config as SiteConfig
}

/**
 * Get all configured MCP connections.
 */
export async function getMcpConnections(): Promise<McpConnection[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  const { data, error } = await supabase
    .from('mcp_connections')
    .select('id, name, slug, transport, url, auth_type, is_system, is_active, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch MCP connections: ${error.message}`)
  }

  // Intentionally omit credentials_encrypted from the response
  return data as McpConnection[]
}
