// ---------------------------------------------------------------------------
// Course Management Tools
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolDefinition } from '../types'

export const tools: ToolDefinition[] = [
  // -----------------------------------------------------------------------
  // create_module
  // -----------------------------------------------------------------------
  {
    name: 'create_module',
    description:
      'Create a new course module (section/chapter). Modules contain lessons and can optionally be linked to a product for gating.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Module title.' },
        description: { type: 'string', description: 'Optional module description.' },
        sort_order: {
          type: 'number',
          description: 'Display order (lower = first). Defaults to appending at the end.',
        },
        product_id: {
          type: 'string',
          description: 'Optional product ID to gate access to this module.',
        },
      },
      required: ['title'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      // Determine sort_order if not provided
      let sortOrder = params.sort_order as number | undefined
      if (sortOrder === undefined) {
        const { data: lastModule } = await supabase
          .from('modules')
          .select('sort_order')
          .order('sort_order', { ascending: false })
          .limit(1)
          .single()
        sortOrder = lastModule ? (lastModule.sort_order as number) + 1 : 0
      }

      const { data, error } = await supabase
        .from('modules')
        .insert({
          title: params.title as string,
          description: (params.description as string) ?? '',
          sort_order: sortOrder,
          product_id: (params.product_id as string) ?? null,
          is_published: false,
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // update_module
  // -----------------------------------------------------------------------
  {
    name: 'update_module',
    description: 'Update an existing course module by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Module UUID.' },
        updates: {
          type: 'object',
          description: 'Fields to update.',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            sort_order: { type: 'number' },
            is_published: { type: 'boolean' },
            product_id: { type: 'string' },
          },
        },
      },
      required: ['id', 'updates'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const id = params.id as string
      const updates = params.updates as Record<string, unknown>

      const { data, error } = await supabase
        .from('modules')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // create_lesson
  // -----------------------------------------------------------------------
  {
    name: 'create_lesson',
    description: 'Create a new lesson within a course module.',
    inputSchema: {
      type: 'object',
      properties: {
        module_id: { type: 'string', description: 'Parent module UUID.' },
        title: { type: 'string', description: 'Lesson title.' },
        content: {
          type: 'string',
          description: 'Lesson content in Markdown or HTML.',
        },
        video_url: {
          type: 'string',
          description: 'Optional video URL (YouTube, Vimeo, or direct link).',
        },
        downloads: {
          type: 'array',
          description: 'Optional array of downloadable resource URLs.',
          items: { type: 'string' },
        },
      },
      required: ['module_id', 'title'],
    },
    async execute(params) {
      const supabase = createAdminClient()

      // Determine sort_order within the module
      const { data: lastLesson } = await supabase
        .from('lessons')
        .select('sort_order')
        .eq('module_id', params.module_id as string)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single()

      const sortOrder = lastLesson ? (lastLesson.sort_order as number) + 1 : 0

      const { data, error } = await supabase
        .from('lessons')
        .insert({
          module_id: params.module_id as string,
          title: params.title as string,
          content: (params.content as string) ?? '',
          video_url: (params.video_url as string) ?? null,
          downloads: (params.downloads as string[]) ?? [],
          sort_order: sortOrder,
          is_published: false,
        })
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // update_lesson
  // -----------------------------------------------------------------------
  {
    name: 'update_lesson',
    description: 'Update an existing lesson by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Lesson UUID.' },
        updates: {
          type: 'object',
          description: 'Fields to update.',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            video_url: { type: 'string' },
            downloads: { type: 'array', items: { type: 'string' } },
            sort_order: { type: 'number' },
            is_published: { type: 'boolean' },
            module_id: { type: 'string' },
          },
        },
      },
      required: ['id', 'updates'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const id = params.id as string
      const updates = params.updates as Record<string, unknown>

      const { data, error } = await supabase
        .from('lessons')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single()

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    },
  },

  // -----------------------------------------------------------------------
  // delete_lesson
  // -----------------------------------------------------------------------
  {
    name: 'delete_lesson',
    description:
      'Permanently delete a lesson by ID. Also removes associated progress records.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Lesson UUID to delete.' },
      },
      required: ['id'],
    },
    async execute(params) {
      const supabase = createAdminClient()
      const id = params.id as string

      // Remove progress records first
      await supabase.from('lesson_progress').delete().eq('lesson_id', id)

      const { error } = await supabase.from('lessons').delete().eq('id', id)

      if (error) return { success: false, error: error.message }
      return { success: true, data: { deleted: id } }
    },
  },

  // -----------------------------------------------------------------------
  // get_course_structure
  // -----------------------------------------------------------------------
  {
    name: 'get_course_structure',
    description:
      'Retrieve the full course structure: all modules with their lessons and aggregate progress statistics.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute() {
      const supabase = createAdminClient()

      // Fetch modules ordered by sort_order
      const { data: modules, error: modError } = await supabase
        .from('modules')
        .select('*')
        .order('sort_order', { ascending: true })

      if (modError) return { success: false, error: modError.message }

      // Fetch all lessons ordered by sort_order
      const { data: lessons, error: lessonError } = await supabase
        .from('lessons')
        .select('*')
        .order('sort_order', { ascending: true })

      if (lessonError) return { success: false, error: lessonError.message }

      // Fetch aggregate progress counts per lesson
      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('lesson_id, completed')

      // Build a progress map: lesson_id -> { total, completed }
      const progressMap: Record<string, { total: number; completed: number }> = {}
      if (progressData) {
        for (const row of progressData) {
          const lid = row.lesson_id as string
          if (!progressMap[lid]) progressMap[lid] = { total: 0, completed: 0 }
          progressMap[lid].total += 1
          if (row.completed) progressMap[lid].completed += 1
        }
      }

      // Assemble structure
      const structure = (modules ?? []).map((mod: Record<string, unknown>) => {
        const modLessons = (lessons ?? [])
          .filter((l: Record<string, unknown>) => l.module_id === mod.id)
          .map((l: Record<string, unknown>) => ({
            ...l,
            progress: progressMap[l.id as string] ?? { total: 0, completed: 0 },
          }))

        return {
          ...mod,
          lessons: modLessons,
          lessonCount: modLessons.length,
        }
      })

      return { success: true, data: structure }
    },
  },
]
