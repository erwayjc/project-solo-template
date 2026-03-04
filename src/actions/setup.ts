'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'
import { getResend } from '@/lib/resend/client'
import { getAnthropic } from '@/lib/claude/client'
import { getProfiles as getBufferProfiles } from '@/lib/buffer/client'
import type { SetupWizardStep, HealthCheckResult, BrandColors } from '@/types'
import type { Database } from '@/lib/supabase/types'
import type { Json } from '@/lib/supabase/types'

type TableName = keyof Database['public']['Tables']

/**
 * Guard: only callable during setup (setup_complete=false) or by an admin.
 * Returns true if access is allowed.
 */
async function requireSetupAccess(): Promise<void> {
  const admin = createAdminClient()
  const { data: config } = await admin
    .from('site_config')
    .select('setup_complete')
    .eq('id', 1)
    .single()

  // During initial setup (no config or setup not complete), allow access
  if (!config || config.setup_complete !== true) {
    return
  }

  // After setup is complete, require admin auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  // Use admin client to read profile to avoid RLS recursion on profiles table
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required')
  }
}

/**
 * Get the current setup status — 9 steps with completion derived from site_config.
 * Accessible during setup (F3 fix) or by admin after setup.
 */
export async function getSetupStatus(): Promise<{
  isComplete: boolean
  steps: SetupWizardStep[]
  siteConfig: Record<string, unknown> | null
}> {
  await requireSetupAccess()

  const admin = createAdminClient()

  const { data: siteConfig } = await admin
    .from('site_config')
    .select('*')
    .eq('id', 1)
    .single()

  // Check database tables
  const { error: tableCheckError } = await admin
    .from('profiles')
    .select('id')
    .limit(0)
  const tablesExist = !tableCheckError

  const steps: SetupWizardStep[] = [
    {
      id: 'account',
      title: 'Create Your Account',
      status: siteConfig?.admin_user_id ? 'complete' : 'pending',
    },
    {
      id: 'database',
      title: 'Database Connection',
      status: tablesExist ? 'complete' : 'pending',
    },
    {
      id: 'payments',
      title: 'Payments',
      status: process.env.STRIPE_SECRET_KEY ? 'complete' : 'pending',
    },
    {
      id: 'email',
      title: 'Email',
      status: process.env.RESEND_API_KEY ? 'complete' : 'pending',
    },
    {
      id: 'ai',
      title: 'AI Connection',
      status: process.env.ANTHROPIC_API_KEY ? 'complete' : 'pending',
    },
    {
      id: 'social',
      title: 'Social Publishing',
      status: process.env.BUFFER_ACCESS_TOKEN ? 'complete' : 'pending',
    },
    {
      id: 'branding',
      title: 'Brand Your Business',
      status: siteConfig?.brand_colors ? 'complete' : 'pending',
    },
    {
      id: 'context',
      title: 'Clone Your Brain',
      status: siteConfig?.master_context ? 'complete' : 'pending',
    },
    {
      id: 'launch',
      title: 'Launch',
      status: siteConfig?.setup_complete ? 'complete' : 'pending',
    },
  ]

  return {
    isComplete: siteConfig?.setup_complete === true,
    steps,
    siteConfig: siteConfig as Record<string, unknown> | null,
  }
}

/**
 * Run database migration check — verify that all expected tables exist.
 * Protected by setup access guard (F5 fix).
 */
export async function runMigration(): Promise<{
  success: boolean
  tables: string[]
  missing: string[]
}> {
  await requireSetupAccess()

  const admin = createAdminClient()

  const expectedTables = [
    'profiles',
    'site_config',
    'products',
    'purchases',
    'modules',
    'lessons',
    'lesson_progress',
    'leads',
    'pages',
    'email_sequences',
    'email_sequence_steps',
    'email_sends',
    'broadcasts',
    'sequence_enrollments',
    'blog_posts',
    'content_queue',
    'support_tickets',
    'agents',
    'agent_conversations',
    'mcp_connections',
    'announcements',
    'media',
  ]

  const found: string[] = []
  const missing: string[] = []

  for (const table of expectedTables) {
    const { error } = await admin.from(table as TableName).select('*').limit(0)
    if (error) {
      missing.push(table)
    } else {
      found.push(table)
    }
  }

  return {
    success: missing.length === 0,
    tables: found,
    missing,
  }
}

/**
 * Validate a specific setup step with the provided data.
 */
export async function validateStep(
  step: string,
  data: Record<string, unknown>
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []

  switch (step) {
    case 'admin-account': {
      if (!data.email || typeof data.email !== 'string') {
        errors.push('Email is required')
      }
      if (!data.password || typeof data.password !== 'string') {
        errors.push('Password is required')
      } else if ((data.password as string).length < 8) {
        errors.push('Password must be at least 8 characters')
      }
      if (!data.fullName || typeof data.fullName !== 'string') {
        errors.push('Full name is required')
      }
      break
    }
    case 'branding': {
      if (!data.site_name || typeof data.site_name !== 'string') {
        errors.push('Site name is required')
      }
      break
    }
    default:
      break
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Check Stripe API connectivity. Protected by setup access guard (F4 fix).
 */
export async function checkStripeHealth(): Promise<HealthCheckResult> {
  await requireSetupAccess()

  if (!process.env.STRIPE_SECRET_KEY) {
    return { service: 'stripe', status: 'not_configured' }
  }
  try {
    const stripe = getStripe()
    await stripe.accounts.retrieve()
    return { service: 'stripe', status: 'connected' }
  } catch {
    return {
      service: 'stripe',
      status: 'error',
      message: 'Failed to connect to Stripe. Check your API key.',
    }
  }
}

/**
 * Check Resend API connectivity. Protected by setup access guard (F4 fix).
 */
export async function checkResendHealth(): Promise<HealthCheckResult> {
  await requireSetupAccess()

  if (!process.env.RESEND_API_KEY) {
    return { service: 'resend', status: 'not_configured' }
  }
  try {
    const resend = getResend()
    await resend.apiKeys.list()
    return { service: 'resend', status: 'connected' }
  } catch {
    return {
      service: 'resend',
      status: 'error',
      message: 'Failed to connect to Resend. Check your API key.',
    }
  }
}

/**
 * Check Anthropic API connectivity. Protected by setup access guard (F4 fix).
 */
export async function checkAnthropicHealth(): Promise<HealthCheckResult> {
  await requireSetupAccess()

  if (!process.env.ANTHROPIC_API_KEY) {
    return { service: 'anthropic', status: 'not_configured' }
  }
  try {
    const anthropic = getAnthropic()
    await anthropic.models.list({ limit: 1 })
    return { service: 'anthropic', status: 'connected' }
  } catch {
    return {
      service: 'anthropic',
      status: 'error',
      message: 'Failed to connect to Anthropic. Check your API key.',
    }
  }
}

/**
 * Check Buffer API connectivity. Protected by setup access guard (F4 fix).
 */
export async function checkBufferHealth(): Promise<HealthCheckResult> {
  await requireSetupAccess()

  if (!process.env.BUFFER_ACCESS_TOKEN) {
    return { service: 'buffer', status: 'not_configured' }
  }
  try {
    await getBufferProfiles()
    return { service: 'buffer', status: 'connected' }
  } catch {
    return {
      service: 'buffer',
      status: 'error',
      message: 'Failed to connect to Buffer. Check your access token.',
    }
  }
}

/**
 * Save branding configuration to site_config.
 */
export async function saveBrandingConfig(data: {
  site_name: string
  tagline: string
  logo_url?: string
  brand_colors: BrandColors
  legal_business_name?: string
  legal_contact_email?: string
}): Promise<{ success: boolean }> {
  await requireSetupAccess()

  if (!data.site_name.trim()) {
    throw new Error('Site name is required')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('site_config')
    .update({
      site_name: data.site_name.trim(),
      tagline: data.tagline.trim(),
      logo_url: data.logo_url?.trim() || null,
      brand_colors: data.brand_colors as unknown as Json,
      legal_business_name: data.legal_business_name?.trim() || null,
      legal_contact_email: data.legal_contact_email?.trim() || null,
    })
    .eq('id', 1)

  if (error) {
    throw new Error('Failed to save branding configuration')
  }

  return { success: true }
}

/**
 * Save master context to site_config.
 */
export async function saveMasterContext(
  context: string
): Promise<{ success: boolean }> {
  await requireSetupAccess()

  const admin = createAdminClient()
  const { error } = await admin
    .from('site_config')
    .update({ master_context: context.trim() })
    .eq('id', 1)

  if (error) {
    throw new Error('Failed to save master context')
  }

  return { success: true }
}

/**
 * Mark setup as complete in site_config.
 */
export async function completeSetup(): Promise<{ success: boolean }> {
  await requireSetupAccess()

  const admin = createAdminClient()
  const { error } = await admin
    .from('site_config')
    .update({ setup_complete: true })
    .eq('id', 1)

  if (error) {
    throw new Error('Failed to complete setup')
  }

  return { success: true }
}

/**
 * Create the initial admin account during first-time setup.
 * Uses the admin client because no authenticated user exists yet.
 * Protected: only callable when setup is not complete (F2 fix).
 * Race-safe: uses conditional update on site_config.admin_user_id (F6 fix).
 * Server-side validated (F15 fix).
 */
export async function createAdminAccount(
  email: string,
  password: string,
  fullName: string
): Promise<{ success: boolean; userId: string }> {
  const admin = createAdminClient()

  // F2: Only allow during initial setup
  const { data: config } = await admin
    .from('site_config')
    .select('setup_complete, admin_user_id')
    .eq('id', 1)
    .single()

  if (config?.setup_complete) {
    throw new Error('Setup is already complete')
  }

  if (config?.admin_user_id) {
    throw new Error('An admin account already exists')
  }

  // F15: Server-side input validation
  const trimmedEmail = email.trim().toLowerCase()
  const trimmedName = fullName.trim()

  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new Error('A valid email address is required')
  }

  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }

  if (!trimmedName || trimmedName.length < 1) {
    throw new Error('Full name is required')
  }

  // Create the auth user
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email: trimmedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: trimmedName,
      },
    })

  if (authError) {
    throw new Error('Failed to create admin account. The email may already be in use.')
  }

  if (!authData.user) {
    throw new Error('Account creation failed unexpectedly')
  }

  // F14: Wait briefly for the profile trigger to create the row, then retry
  let profileUpdated = false
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error: profileError, count } = await admin
      .from('profiles')
      .update({ role: 'admin', full_name: trimmedName, email: trimmedEmail })
      .eq('id', authData.user.id)

    if (!profileError && (count === null || count > 0)) {
      profileUpdated = true
      break
    }

    // Wait 500ms before retrying (trigger may not have fired yet)
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  if (!profileUpdated) {
    throw new Error('Failed to configure admin role. Please try again.')
  }

  // F6: Conditional update — only set admin_user_id if it's still null (race protection)
  const { data: configUpdate } = await admin
    .from('site_config')
    .update({ admin_user_id: authData.user.id })
    .eq('id', 1)
    .is('admin_user_id', null)
    .select('id')

  if (!configUpdate || configUpdate.length === 0) {
    // Another request won the race — revert this user to non-admin
    await admin
      .from('profiles')
      .update({ role: 'customer' })
      .eq('id', authData.user.id)
    throw new Error('An admin account was created by another request. Please refresh.')
  }

  return { success: true, userId: authData.user.id }
}
