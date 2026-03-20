'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireAdmin } from '@/lib/auth/helpers'
import type { Module, Lesson, LessonProgress } from '@/types/database'
import type { Json } from '@/lib/supabase/types'

// ── Modules ──

export async function getModules(): Promise<Module[]> {
  const supabase = await createClient()

  // Check if caller is admin — non-admins only see published modules
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
    .from('modules')
    .select('*')
    .order('sort_order', { ascending: true })

  if (!isAdmin) {
    query = query.eq('is_published', true)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch modules: ${error.message}`)
  }

  return data as Module[]
}

export async function createModule(moduleData: {
  title: string
  description?: string
  product_id?: string
  sort_order?: number
  is_published?: boolean
}): Promise<Module> {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('modules')
    .insert(moduleData)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create module: ${error.message}`)
  }

  return data as Module
}

export async function updateModule(
  id: string,
  moduleData: Partial<Omit<Module, 'id'>>
): Promise<Module> {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('modules')
    .update(moduleData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update module: ${error.message}`)
  }

  return data as Module
}

// ── Lessons ──

export async function getLessons(moduleId: string): Promise<Lesson[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('module_id', moduleId)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch lessons: ${error.message}`)
  }

  return data as Lesson[]
}

export async function createLesson(lessonData: {
  module_id: string
  title: string
  content?: string
  video_url?: string
  downloads?: Record<string, unknown>[]
  sort_order?: number
  is_published?: boolean
}): Promise<Lesson> {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('lessons')
    .insert({
      ...lessonData,
      downloads: lessonData.downloads as unknown as Json,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create lesson: ${error.message}`)
  }

  return data as Lesson
}

export async function updateLesson(
  id: string,
  lessonData: Partial<Omit<Lesson, 'id'>>
): Promise<Lesson> {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from('lessons')
    .update(lessonData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update lesson: ${error.message}`)
  }

  return data as Lesson
}

export async function deleteLesson(id: string): Promise<void> {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('lessons')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete lesson: ${error.message}`)
  }
}

// ── Progress (portal users) ──

export async function toggleLessonProgress(
  lessonId: string
): Promise<LessonProgress> {
  const { supabase, user } = await requireAuth()

  // Check current state to determine toggle direction
  const { data: existing } = await supabase
    .from('lesson_progress')
    .select('completed')
    .eq('user_id', user.id)
    .eq('lesson_id', lessonId)
    .maybeSingle()

  // Toggle: if exists and completed, mark incomplete; otherwise mark complete
  const newCompleted = !(existing?.completed ?? false)

  const { data, error } = await supabase
    .from('lesson_progress')
    .upsert(
      {
        user_id: user.id,
        lesson_id: lessonId,
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      },
      { onConflict: 'user_id,lesson_id' }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to toggle progress: ${error.message}`)
  }

  return data as LessonProgress
}

export async function getCourseProgress(): Promise<{
  total: number
  completed: number
  percentage: number
}> {
  const { supabase, user } = await requireAuth()

  // Count total published lessons
  const { count: totalLessons } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true)

  // Count completed lessons for this user
  const { count: completedLessons } = await supabase
    .from('lesson_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('completed', true)

  const total = totalLessons ?? 0
  const completed = completedLessons ?? 0
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  return { total, completed, percentage }
}
