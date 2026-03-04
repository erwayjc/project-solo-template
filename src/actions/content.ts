'use server'

import { createClient } from '@/lib/supabase/server'
import type { BlogPost, ContentQueue } from '@/types/database'
import type { Json } from '@/lib/supabase/types'

// ── Blog Posts ──

export async function getBlogPosts(filters?: {
  status?: string
  tag?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<{ posts: BlogPost[]; count: number }> {
  const supabase = await createClient()

  // Check if caller is admin — non-admins can only see published posts
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.role === 'admin'
  }

  let query = supabase
    .from('blog_posts')
    .select('*', { count: 'exact' })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  } else if (!isAdmin) {
    // Non-admins can only see published posts
    query = query.eq('status', 'published')
  }

  if (filters?.tag) {
    query = query.contains('tags', [filters.tag])
  }

  if (filters?.search) {
    // Sanitize search input: escape PostgREST special characters to prevent filter injection
    const sanitized = filters.search.replace(/[%_\\,().]/g, (c) => `\\${c}`)
    query = query.or(
      `title.ilike.%${sanitized}%,excerpt.ilike.%${sanitized}%`
    )
  }

  query = query.order('published_at', { ascending: false, nullsFirst: false })

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  if (filters?.offset) {
    query = query.range(
      filters.offset,
      filters.offset + (filters.limit || 50) - 1
    )
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch blog posts: ${error.message}`)
  }

  return { posts: data as BlogPost[], count: count ?? 0 }
}

export async function createBlogPost(postData: {
  title: string
  slug: string
  content?: string
  excerpt?: string
  featured_image?: string
  tags?: string[]
  seo?: Record<string, unknown>
  status?: string
}): Promise<BlogPost> {
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

  const insertData = {
    ...postData,
    seo: postData.seo as unknown as Json,
    published_at:
      postData.status === 'published' ? new Date().toISOString() : null,
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create blog post: ${error.message}`)
  }

  return data as BlogPost
}

export async function updateBlogPost(
  id: string,
  postData: Partial<Omit<BlogPost, 'id'>>
): Promise<BlogPost> {
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

  // If publishing for the first time, set published_at
  const updateData = { ...postData } as Record<string, unknown>
  if (postData.status === 'published') {
    // Only set published_at if not already set
    const { data: existing } = await supabase
      .from('blog_posts')
      .select('published_at')
      .eq('id', id)
      .single()

    if (!existing?.published_at) {
      updateData.published_at = new Date().toISOString()
    }
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update blog post: ${error.message}`)
  }

  return data as BlogPost
}

export async function checkBlogSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  let query = supabase
    .from('blog_posts')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { count } = await query
  return (count ?? 0) === 0
}

export async function getBlogPost(id: string): Promise<BlogPost> {
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
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`Failed to fetch blog post: ${error.message}`)
  }

  return data as BlogPost
}

export async function deleteBlogPost(id: string): Promise<void> {
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

  const { error } = await supabase.from('blog_posts').delete().eq('id', id)

  if (error) {
    throw new Error(`Failed to delete blog post: ${error.message}`)
  }
}

// ── Content Queue (Social Media) ──

export async function getContentQueue(filters?: {
  platform?: string
  status?: string
  limit?: number
}): Promise<ContentQueue[]> {
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

  let query = supabase.from('content_queue').select('*')

  if (filters?.platform) {
    query = query.eq('platform', filters.platform)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  query = query.order('scheduled_for', {
    ascending: true,
    nullsFirst: false,
  })

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch content queue: ${error.message}`)
  }

  return data as ContentQueue[]
}

export async function createSocialContent(contentData: {
  platform: string
  content: string
  media_urls?: string[]
  scheduled_for?: string
  source_content_id?: string
}): Promise<ContentQueue> {
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
    .from('content_queue')
    .insert({
      ...contentData,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create social content: ${error.message}`)
  }

  return data as ContentQueue
}

export async function approveSocialContent(id: string): Promise<ContentQueue> {
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
    .from('content_queue')
    .update({ status: 'approved' })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to approve content: ${error.message}`)
  }

  return data as ContentQueue
}

export async function rejectSocialContent(id: string): Promise<ContentQueue> {
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
    .from('content_queue')
    .update({ status: 'draft' })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to reject content: ${error.message}`)
  }

  return data as ContentQueue
}

export async function updateSocialContent(
  id: string,
  contentData: {
    content?: string
    platform?: string
    scheduled_for?: string | null
    media_urls?: string[]
  }
): Promise<ContentQueue> {
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

  // Only allow updating known safe fields
  const safeUpdate: Record<string, unknown> = {}
  if (contentData.content !== undefined) safeUpdate.content = contentData.content
  if (contentData.platform !== undefined) safeUpdate.platform = contentData.platform
  if (contentData.scheduled_for !== undefined) safeUpdate.scheduled_for = contentData.scheduled_for
  if (contentData.media_urls !== undefined) safeUpdate.media_urls = contentData.media_urls

  const { data, error } = await supabase
    .from('content_queue')
    .update(safeUpdate)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update content: ${error.message}`)
  }

  return data as ContentQueue
}

export async function deleteSocialContent(id: string): Promise<void> {
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

  const { error } = await supabase.from('content_queue').delete().eq('id', id)

  if (error) {
    throw new Error(`Failed to delete content: ${error.message}`)
  }
}

export async function rescheduleSocialContent(
  id: string,
  scheduledFor: string
): Promise<ContentQueue> {
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

  // Atomically reschedule and auto-approve drafts in a single update
  // First try to update drafts (sets status to approved)
  const { data: draftData, error: draftError } = await supabase
    .from('content_queue')
    .update({ scheduled_for: scheduledFor, status: 'approved' })
    .eq('id', id)
    .eq('status', 'draft')
    .select()
    .maybeSingle()

  if (draftError) {
    throw new Error(`Failed to reschedule content: ${draftError.message}`)
  }

  if (draftData) return draftData as ContentQueue

  // Not a draft — just update the schedule
  const { data, error } = await supabase
    .from('content_queue')
    .update({ scheduled_for: scheduledFor })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to reschedule content: ${error.message}`)
  }

  return data as ContentQueue
}

export async function getContentCalendar(
  startDate: string,
  endDate: string
): Promise<{
  blogPosts: BlogPost[]
  socialContent: ContentQueue[]
}> {
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

  const [blogResult, socialResult] = await Promise.all([
    supabase
      .from('blog_posts')
      .select('*')
      .gte('published_at', startDate)
      .lte('published_at', endDate)
      .order('published_at', { ascending: true }),
    supabase
      .from('content_queue')
      .select('*')
      .gte('scheduled_for', startDate)
      .lte('scheduled_for', endDate)
      .order('scheduled_for', { ascending: true }),
  ])

  if (blogResult.error) {
    throw new Error(
      `Failed to fetch blog calendar: ${blogResult.error.message}`
    )
  }

  if (socialResult.error) {
    throw new Error(
      `Failed to fetch social calendar: ${socialResult.error.message}`
    )
  }

  return {
    blogPosts: blogResult.data as BlogPost[],
    socialContent: socialResult.data as ContentQueue[],
  }
}
