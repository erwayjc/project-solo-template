'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Testimonial, TestimonialUpdate, TestimonialRequest } from '@/types/database'

export async function getTestimonials(filters?: {
  published?: boolean
}): Promise<Testimonial[]> {
  const supabase = await createClient()

  // Querying unpublished testimonials requires admin auth
  if (filters?.published !== true) {
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
  }

  let query = supabase.from('testimonials').select('*')

  if (filters?.published !== undefined) {
    query = query.eq('is_published', filters.published)
  }

  query = query.order('sort_order', { ascending: true }).order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch testimonials: ${error.message}`)
  }

  return data as Testimonial[]
}

export async function createTestimonial(testimonialData: {
  name: string
  quote: string
  role?: string
  company?: string
  image_url?: string
}): Promise<Testimonial> {
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
    .from('testimonials')
    .insert({
      ...testimonialData,
      is_published: false,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create testimonial: ${error.message}`)
  }

  return data as Testimonial
}

export async function updateTestimonial(
  id: string,
  testimonialData: Partial<TestimonialUpdate>
): Promise<Testimonial> {
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
    .from('testimonials')
    .update(testimonialData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update testimonial: ${error.message}`)
  }

  return data as Testimonial
}

export async function deleteTestimonial(id: string): Promise<void> {
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

  const { error } = await supabase.from('testimonials').delete().eq('id', id)

  if (error) {
    throw new Error(`Failed to delete testimonial: ${error.message}`)
  }
}

export async function reorderTestimonials(orderedIds: string[]): Promise<void> {
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

  // Batch all reorder updates in parallel for consistency
  const results = await Promise.all(
    orderedIds.map((id, i) =>
      supabase
        .from('testimonials')
        .update({ sort_order: i })
        .eq('id', id)
    )
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) {
    throw new Error(`Failed to reorder testimonials: ${failed.error.message}`)
  }
}

// ── Customer-Facing Testimonial Request Flow ──

export async function getMyTestimonialRequest(): Promise<TestimonialRequest | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data } = await supabase
    .from('testimonial_requests')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as TestimonialRequest) ?? null
}

export async function submitTestimonial(data: {
  quote: string
  name?: string
}): Promise<void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // Create testimonial via admin client (user doesn't have insert permission on testimonials)
  const admin = createAdminClient()

  const { error: insertError } = await admin.from('testimonials').insert({
    name: data.name || profile?.full_name || 'Anonymous',
    quote: data.quote,
    is_published: false,
  })

  if (insertError) {
    throw new Error(`Failed to submit testimonial: ${insertError.message}`)
  }

  // Update the pending request to submitted
  const { error: updateError } = await supabase
    .from('testimonial_requests')
    .update({
      status: 'submitted',
      responded_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('status', 'pending')

  if (updateError) {
    throw new Error(`Failed to update request status: ${updateError.message}`)
  }
}

export async function dismissTestimonialRequest(): Promise<void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { error } = await supabase
    .from('testimonial_requests')
    .update({
      status: 'dismissed',
      responded_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('status', 'pending')

  if (error) {
    throw new Error(`Failed to dismiss request: ${error.message}`)
  }
}
