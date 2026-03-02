'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SetupWizardStep } from '@/types'
import type { Database } from '@/lib/supabase/types'

type TableName = keyof Database['public']['Tables']

/**
 * Get the current setup status — which steps are complete, pending, or errored.
 */
export async function getSetupStatus(): Promise<{
  isComplete: boolean
  steps: SetupWizardStep[]
}> {
  const supabase = await createClient()

  const { data: siteConfig } = await supabase
    .from('site_config')
    .select('*')
    .eq('id', 1)
    .single()

  const steps: SetupWizardStep[] = [
    {
      id: 'admin-account',
      title: 'Create Admin Account',
      status: siteConfig?.admin_user_id ? 'complete' : 'pending',
    },
    {
      id: 'branding',
      title: 'Configure Branding',
      status:
        siteConfig?.site_name && siteConfig.site_name !== 'My Business'
          ? 'complete'
          : 'pending',
    },
    {
      id: 'integrations',
      title: 'Connect Integrations',
      status:
        process.env.STRIPE_SECRET_KEY &&
        process.env.RESEND_API_KEY &&
        process.env.ANTHROPIC_API_KEY
          ? 'complete'
          : 'pending',
    },
    {
      id: 'content',
      title: 'Add Initial Content',
      status: 'pending',
      data: {
        hint: 'Create at least one product, module, or blog post',
      },
    },
  ]

  return {
    isComplete: siteConfig?.setup_complete === true,
    steps,
  }
}

/**
 * Run database migration check — verify that all expected tables exist.
 */
export async function runMigration(): Promise<{
  success: boolean
  tables: string[]
  missing: string[]
}> {
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
    case 'integrations': {
      // Integrations are configured via env vars, nothing to validate here
      break
    }
    case 'content': {
      // Content step is optional
      break
    }
    default:
      errors.push(`Unknown step: ${step}`)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Mark setup as complete in site_config.
 */
export async function completeSetup(): Promise<{ success: boolean }> {
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

  const { error } = await supabase
    .from('site_config')
    .update({ setup_complete: true })
    .eq('id', 1)

  if (error) {
    throw new Error(`Failed to complete setup: ${error.message}`)
  }

  return { success: true }
}

/**
 * Create the initial admin account during first-time setup.
 * Uses the admin client because no authenticated user exists yet.
 */
export async function createAdminAccount(
  email: string,
  password: string,
  fullName: string
): Promise<{ success: boolean; userId: string }> {
  const admin = createAdminClient()

  // Check if an admin already exists
  const { data: existingAdmin } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single()

  if (existingAdmin) {
    throw new Error('An admin account already exists')
  }

  // Create the auth user
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    })

  if (authError) {
    throw new Error(`Failed to create admin user: ${authError.message}`)
  }

  if (!authData.user) {
    throw new Error('User creation returned no user')
  }

  // The trigger will create the profile with role='lead', so we upgrade to admin
  const { error: profileError } = await admin
    .from('profiles')
    .update({ role: 'admin', full_name: fullName, email })
    .eq('id', authData.user.id)

  if (profileError) {
    throw new Error(`Failed to set admin role: ${profileError.message}`)
  }

  // Store the admin user ID in site_config
  const { error: configError } = await admin
    .from('site_config')
    .update({ admin_user_id: authData.user.id })
    .eq('id', 1)

  if (configError) {
    throw new Error(
      `Failed to update site config with admin ID: ${configError.message}`
    )
  }

  return { success: true, userId: authData.user.id }
}
