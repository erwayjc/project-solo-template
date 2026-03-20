'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/helpers'
import type { Json } from '@/lib/supabase/types'
import type { OnboardingChecklist, OnboardingProgress, BrandColors } from '@/types'

// Seed data constants for derivation
const SEED_BLOG_COUNT = 3
const SEED_PRIMARY_COLOR = '#2563eb'
const SEED_SITE_NAME = 'My Business'

/**
 * Get full onboarding progress — combines derived state with stored JSONB flags.
 * Single source of truth for all onboarding status.
 */
export async function getOnboardingProgress(): Promise<OnboardingProgress> {
  await requireAdmin()

  const admin = createAdminClient()

  // Fetch site config
  const { data: config } = await admin
    .from('site_config')
    .select('onboarding_checklist, brand_colors, master_context, site_name')
    .eq('id', 1)
    .single()

  const checklist = (config?.onboarding_checklist ?? {}) as OnboardingChecklist

  // Derive blog post creation: more posts than seed count means user created their own
  const { count: blogCount } = await admin
    .from('blog_posts')
    .select('id', { count: 'exact', head: true })

  const createdFirstPost = (blogCount ?? 0) > SEED_BLOG_COUNT

  // Derive homepage edit: compare home page sections against seed content
  const { data: homePage } = await admin
    .from('pages')
    .select('sections')
    .eq('slug', 'home')
    .single()

  let editedHomepage = false
  if (homePage?.sections) {
    const sections = homePage.sections as { type: string; headline?: string }[]
    if (Array.isArray(sections) && sections.length > 0) {
      const heroSection = sections.find((s) => s.type === 'hero')
      editedHomepage = heroSection?.headline !== 'Build Your Dream Business — Powered by AI'
    }
  }

  // Derive brand customization
  const brandColors = config?.brand_colors as BrandColors | null
  const brandCustomized =
    (brandColors?.primary !== SEED_PRIMARY_COLOR) ||
    (config?.site_name !== SEED_SITE_NAME)

  // Integration status from env vars
  const paymentsConnected = !!process.env.STRIPE_SECRET_KEY
  const emailConnected = !!process.env.RESEND_API_KEY
  const aiConnected = !!process.env.ANTHROPIC_API_KEY
  const socialConnected = !!process.env.BUFFER_ACCESS_TOKEN

  return {
    quickWins: {
      explored_admin: checklist.explored_admin ?? false,
      created_first_post: createdFirstPost,
      edited_homepage: editedHomepage,
    },
    powerUps: {
      payments_connected: paymentsConnected,
      email_connected: emailConnected,
      ai_connected: aiConnected,
      social_connected: socialConnected,
    },
    personalization: {
      brand_customized: brandCustomized,
      context_configured: !!config?.master_context,
    },
    guide_dismissed: checklist.guide_dismissed ?? false,
    celebration_flags: {
      first_post_celebrated: checklist.first_post_celebrated ?? false,
      first_checklist_celebrated: checklist.first_checklist_celebrated ?? false,
    },
  }
}

/**
 * Atomically merge updates into the onboarding_checklist JSONB on site_config.
 * Uses a SQL function (migration 00019) to avoid read-then-write race conditions.
 */
export async function updateOnboardingChecklist(
  updates: Partial<OnboardingChecklist>
): Promise<{ success: boolean }> {
  await requireAdmin()

  const admin = createAdminClient()

  const { error } = await admin.rpc('merge_onboarding_checklist', {
    updates: updates as unknown as Json,
  })

  if (error) throw new Error('Failed to update onboarding checklist')

  return { success: true }
}

/**
 * Delete all sample content rows by their known fixed UUIDs.
 * Respects foreign key dependency order. Collects errors per step.
 */
export async function clearSampleContent(): Promise<{ success: boolean; deleted: number; errors: string[] }> {
  await requireAdmin()

  const admin = createAdminClient()
  let totalDeleted = 0
  const errors: string[] = []

  const SAMPLE_UUIDS = {
    lessons: [
      'c1b2c3d4-0001-4000-8000-000000000001',
      'c1b2c3d4-0002-4000-8000-000000000002',
      'c1b2c3d4-0003-4000-8000-000000000003',
      'c1b2c3d4-0004-4000-8000-000000000004',
    ],
    modules: [
      'b1b2c3d4-0001-4000-8000-000000000001',
      'b1b2c3d4-0002-4000-8000-000000000002',
    ],
    email_sequence_steps: [
      'f1b2c3d4-0001-4000-8000-000000000001',
      'f1b2c3d4-0002-4000-8000-000000000002',
      'f1b2c3d4-0003-4000-8000-000000000003',
    ],
    email_sequences: [
      'e1b2c3d4-0001-4000-8000-000000000001',
    ],
    content_queue: [
      'c0a11b2c-0001-4000-8000-000000000001',
      'c0a11b2c-0002-4000-8000-000000000002',
      'c0a11b2c-0003-4000-8000-000000000003',
    ],
    blog_posts: [
      '71b2c3d4-0001-4000-8000-000000000001',
      'b10a1b2c-0002-4000-8000-000000000002',
      'b10a1b2c-0003-4000-8000-000000000003',
    ],
    products: [
      'a1b2c3d4-0001-4000-8000-000000000001',
      'a1b2c3d4-0002-4000-8000-000000000002',
    ],
    testimonials: [
      '91b2c3d4-0001-4000-8000-000000000001',
      '91b2c3d4-0002-4000-8000-000000000002',
      '91b2c3d4-0003-4000-8000-000000000003',
    ],
    announcements: [
      '81b2c3d4-0001-4000-8000-000000000001',
    ],
  }

  // Delete in dependency order (children first)
  // Each step wrapped in try/catch to continue on partial failure

  // 1. lesson_progress for sample lessons
  try {
    await admin
      .from('lesson_progress')
      .delete()
      .in('lesson_id', SAMPLE_UUIDS.lessons)
  } catch (e) {
    errors.push(`lesson_progress: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }

  // 2. lessons
  try {
    const { count: c1 } = await admin
      .from('lessons')
      .delete({ count: 'exact' })
      .in('id', SAMPLE_UUIDS.lessons)
    totalDeleted += c1 ?? 0
  } catch (e) {
    errors.push(`lessons: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }

  // 3. modules
  try {
    const { count: c2 } = await admin
      .from('modules')
      .delete({ count: 'exact' })
      .in('id', SAMPLE_UUIDS.modules)
    totalDeleted += c2 ?? 0
  } catch (e) {
    errors.push(`modules: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }

  // 4. email_sequence_steps
  try {
    const { count: c3 } = await admin
      .from('email_sequence_steps')
      .delete({ count: 'exact' })
      .in('id', SAMPLE_UUIDS.email_sequence_steps)
    totalDeleted += c3 ?? 0
  } catch (e) {
    errors.push(`email_sequence_steps: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }

  // 5. email_sequences
  try {
    const { count: c4 } = await admin
      .from('email_sequences')
      .delete({ count: 'exact' })
      .in('id', SAMPLE_UUIDS.email_sequences)
    totalDeleted += c4 ?? 0
  } catch (e) {
    errors.push(`email_sequences: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }

  // 6. content_queue
  try {
    const { count: c5 } = await admin
      .from('content_queue')
      .delete({ count: 'exact' })
      .in('id', SAMPLE_UUIDS.content_queue)
    totalDeleted += c5 ?? 0
  } catch (e) {
    errors.push(`content_queue: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }

  // 7. blog_posts
  try {
    const { count: c6 } = await admin
      .from('blog_posts')
      .delete({ count: 'exact' })
      .in('id', SAMPLE_UUIDS.blog_posts)
    totalDeleted += c6 ?? 0
  } catch (e) {
    errors.push(`blog_posts: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }

  // 8. purchases referencing sample products (FK dependency)
  try {
    await admin
      .from('purchases')
      .delete()
      .in('product_id', SAMPLE_UUIDS.products)
  } catch (e) {
    errors.push(`purchases: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }

  // 9. products
  try {
    const { count: c7 } = await admin
      .from('products')
      .delete({ count: 'exact' })
      .in('id', SAMPLE_UUIDS.products)
    totalDeleted += c7 ?? 0
  } catch (e) {
    errors.push(`products: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }

  // 10. testimonials
  try {
    const { count: c8 } = await admin
      .from('testimonials')
      .delete({ count: 'exact' })
      .in('id', SAMPLE_UUIDS.testimonials)
    totalDeleted += c8 ?? 0
  } catch (e) {
    errors.push(`testimonials: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }

  // 11. announcements
  try {
    const { count: c9 } = await admin
      .from('announcements')
      .delete({ count: 'exact' })
      .in('id', SAMPLE_UUIDS.announcements)
    totalDeleted += c9 ?? 0
  } catch (e) {
    errors.push(`announcements: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }

  if (errors.length > 0) {
    throw new Error(`Partially cleared sample content (${totalDeleted} deleted). Errors: ${errors.join('; ')}`)
  }

  return { success: true, deleted: totalDeleted, errors }
}
