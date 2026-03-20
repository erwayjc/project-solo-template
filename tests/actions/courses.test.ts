import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock dependencies BEFORE imports
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import {
  getModules,
  createModule,
  getLessons,
  createLesson,
  deleteLesson,
  toggleLessonProgress,
  getCourseProgress,
} from '@/actions/courses'
import { createClient } from '@/lib/supabase/server'

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// getModules
// ---------------------------------------------------------------------------
describe('getModules', () => {
  it('admin sees all modules (no is_published filter)', async () => {
    const allModules = [
      { id: 'm1', title: 'Module 1', is_published: true, sort_order: 1 },
      { id: 'm2', title: 'Module 2', is_published: false, sort_order: 2 },
    ]

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-1' } },
          error: null,
        }),
      },
      from: vi.fn(),
    }

    // Track whether eq was called with 'is_published'
    let isPublishedFiltered = false

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
            }),
          }),
        }
      }
      // modules table
      const chain: Record<string, unknown> = {}
      chain.select = vi.fn().mockReturnValue(chain)
      chain.order = vi.fn().mockReturnValue(chain)
      chain.eq = vi.fn().mockImplementation(() => {
        isPublishedFiltered = true
        return chain
      })
      chain.then = (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: allModules, error: null }).then(resolve)
      return chain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getModules()

    expect(result).toEqual(allModules)
    expect(isPublishedFiltered).toBe(false)
    expect(mockClient.from).toHaveBeenCalledWith('modules')
  })

  it('non-admin sees only published modules', async () => {
    const publishedModules = [
      { id: 'm1', title: 'Module 1', is_published: true, sort_order: 1 },
    ]

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn(),
    }

    const modulesChain: Record<string, unknown> = {}
    modulesChain.select = vi.fn().mockReturnValue(modulesChain)
    modulesChain.order = vi.fn().mockReturnValue(modulesChain)
    modulesChain.eq = vi.fn().mockReturnValue(modulesChain)
    modulesChain.then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: publishedModules, error: null }).then(resolve)

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { role: 'customer' }, error: null }),
            }),
          }),
        }
      }
      return modulesChain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getModules()

    expect(result).toEqual(publishedModules)
    expect(modulesChain.eq).toHaveBeenCalledWith('is_published', true)
  })

  it('unauthenticated user sees only published modules', async () => {
    const publishedModules = [
      { id: 'm1', title: 'Module 1', is_published: true, sort_order: 1 },
    ]

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn(),
    }

    const modulesChain: Record<string, unknown> = {}
    modulesChain.select = vi.fn().mockReturnValue(modulesChain)
    modulesChain.order = vi.fn().mockReturnValue(modulesChain)
    modulesChain.eq = vi.fn().mockReturnValue(modulesChain)
    modulesChain.then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: publishedModules, error: null }).then(resolve)

    mockClient.from.mockImplementation(() => modulesChain)

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getModules()

    expect(result).toEqual(publishedModules)
    expect(modulesChain.eq).toHaveBeenCalledWith('is_published', true)
  })
})

// ---------------------------------------------------------------------------
// createModule
// ---------------------------------------------------------------------------
describe('createModule', () => {
  it('creates module as admin', async () => {
    const newModule = { id: 'm-new', title: 'New Module', sort_order: 1 }

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-1' } },
          error: null,
        }),
      },
      from: vi.fn(),
    }

    const modulesChain: Record<string, unknown> = {}
    modulesChain.insert = vi.fn().mockReturnValue(modulesChain)
    modulesChain.select = vi.fn().mockReturnValue(modulesChain)
    modulesChain.single = vi.fn().mockResolvedValue({ data: newModule, error: null })

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
            }),
          }),
        }
      }
      return modulesChain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await createModule({ title: 'New Module', sort_order: 1 })

    expect(result).toEqual(newModule)
    expect(mockClient.from).toHaveBeenCalledWith('modules')
    expect(modulesChain.insert).toHaveBeenCalledWith({ title: 'New Module', sort_order: 1 })
  })

  it('throws when not admin', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn(),
    }

    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { role: 'customer' }, error: null }),
        }),
      }),
    }))

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(createModule({ title: 'Test' })).rejects.toThrow('Admin access required')
  })
})

// ---------------------------------------------------------------------------
// getLessons
// ---------------------------------------------------------------------------
describe('getLessons', () => {
  it('returns lessons for a module', async () => {
    const lessons = [
      { id: 'l1', title: 'Lesson 1', module_id: 'mod-1', sort_order: 1 },
      { id: 'l2', title: 'Lesson 2', module_id: 'mod-1', sort_order: 2 },
    ]

    const chain: Record<string, unknown> = {}
    chain.select = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.order = vi.fn().mockReturnValue(chain)
    chain.then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: lessons, error: null }).then(resolve)

    const mockClient = {
      from: vi.fn().mockReturnValue(chain),
    }

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getLessons('mod-1')

    expect(result).toEqual(lessons)
    expect(mockClient.from).toHaveBeenCalledWith('lessons')
    expect(chain.eq).toHaveBeenCalledWith('module_id', 'mod-1')
    expect(chain.order).toHaveBeenCalledWith('sort_order', { ascending: true })
  })
})

// ---------------------------------------------------------------------------
// createLesson
// ---------------------------------------------------------------------------
describe('createLesson', () => {
  it('creates lesson as admin', async () => {
    const newLesson = {
      id: 'l-new',
      title: 'New Lesson',
      module_id: 'mod-1',
      downloads: [{ name: 'file.pdf', url: '/file.pdf' }],
    }

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-1' } },
          error: null,
        }),
      },
      from: vi.fn(),
    }

    const lessonsChain: Record<string, unknown> = {}
    lessonsChain.insert = vi.fn().mockReturnValue(lessonsChain)
    lessonsChain.select = vi.fn().mockReturnValue(lessonsChain)
    lessonsChain.single = vi.fn().mockResolvedValue({ data: newLesson, error: null })

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
            }),
          }),
        }
      }
      return lessonsChain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await createLesson({
      module_id: 'mod-1',
      title: 'New Lesson',
      downloads: [{ name: 'file.pdf', url: '/file.pdf' }],
    })

    expect(result).toEqual(newLesson)
    expect(mockClient.from).toHaveBeenCalledWith('lessons')
    expect(lessonsChain.insert).toHaveBeenCalledWith({
      module_id: 'mod-1',
      title: 'New Lesson',
      downloads: [{ name: 'file.pdf', url: '/file.pdf' }],
    })
  })

  it('throws when not admin', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn(),
    }

    mockClient.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { role: 'customer' }, error: null }),
        }),
      }),
    }))

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(
      createLesson({ module_id: 'mod-1', title: 'Test' })
    ).rejects.toThrow('Admin access required')
  })
})

// ---------------------------------------------------------------------------
// deleteLesson
// ---------------------------------------------------------------------------
describe('deleteLesson', () => {
  it('deletes lesson as admin', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-1' } },
          error: null,
        }),
      },
      from: vi.fn(),
    }

    const lessonsChain: Record<string, unknown> = {}
    lessonsChain.delete = vi.fn().mockReturnValue(lessonsChain)
    lessonsChain.eq = vi.fn().mockReturnValue(lessonsChain)
    lessonsChain.then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ error: null }).then(resolve)

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
            }),
          }),
        }
      }
      return lessonsChain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await deleteLesson('lesson-1')

    expect(mockClient.from).toHaveBeenCalledWith('lessons')
    expect(lessonsChain.delete).toHaveBeenCalled()
    expect(lessonsChain.eq).toHaveBeenCalledWith('id', 'lesson-1')
  })
})

// ---------------------------------------------------------------------------
// toggleLessonProgress
// ---------------------------------------------------------------------------
describe('toggleLessonProgress', () => {
  it('creates new progress record when none exists (completed=true)', async () => {
    const newProgress = {
      id: 'prog-1',
      user_id: 'user-1',
      lesson_id: 'lesson-1',
      completed: true,
      completed_at: '2026-03-14T00:00:00.000Z',
    }

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn(),
    }

    let fromCallCount = 0

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'lesson_progress') {
        fromCallCount++
        if (fromCallCount === 1) {
          // First call: check for existing record — returns null (not found)
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }
        }
        // Second call: upsert new progress record
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: newProgress, error: null }),
            }),
          }),
        }
      }
      return {}
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await toggleLessonProgress('lesson-1')

    expect(result).toEqual(newProgress)
    expect(result.completed).toBe(true)
  })

  it('toggles existing progress (completed to not completed)', async () => {
    const existingProgress = {
      id: 'prog-1',
      user_id: 'user-1',
      lesson_id: 'lesson-1',
      completed: true,
      completed_at: '2026-03-14T00:00:00.000Z',
    }

    const toggledProgress = {
      ...existingProgress,
      completed: false,
      completed_at: null,
    }

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn(),
    }

    let fromCallCount = 0

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'lesson_progress') {
        fromCallCount++
        if (fromCallCount === 1) {
          // First call: check for existing record — found
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: existingProgress, error: null }),
                }),
              }),
            }),
          }
        }
        // Second call: upsert to toggle completed
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: toggledProgress, error: null }),
            }),
          }),
        }
      }
      return {}
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await toggleLessonProgress('lesson-1')

    expect(result).toEqual(toggledProgress)
    expect(result.completed).toBe(false)
  })

  it('throws when not authenticated', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn(),
    }

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(toggleLessonProgress('lesson-1')).rejects.toThrow('Authentication required')
  })
})

// ---------------------------------------------------------------------------
// getCourseProgress
// ---------------------------------------------------------------------------
describe('getCourseProgress', () => {
  it('returns correct percentage (3/10 = 30%)', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn(),
    }

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'lessons') {
        // Count total published lessons
        const chain: Record<string, unknown> = {}
        chain.select = vi.fn().mockReturnValue(chain)
        chain.eq = vi.fn().mockReturnValue(chain)
        chain.then = (resolve: (v: unknown) => void) =>
          Promise.resolve({ count: 10, error: null }).then(resolve)
        return chain
      }
      if (table === 'lesson_progress') {
        // Count completed lessons for user
        const chain: Record<string, unknown> = {}
        chain.select = vi.fn().mockReturnValue(chain)
        chain.eq = vi.fn().mockReturnValue(chain)
        chain.then = (resolve: (v: unknown) => void) =>
          Promise.resolve({ count: 3, error: null }).then(resolve)
        return chain
      }
      return {}
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getCourseProgress()

    expect(result).toEqual({ total: 10, completed: 3, percentage: 30 })
  })

  it('returns 0% when no lessons exist', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn(),
    }

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'lessons') {
        const chain: Record<string, unknown> = {}
        chain.select = vi.fn().mockReturnValue(chain)
        chain.eq = vi.fn().mockReturnValue(chain)
        chain.then = (resolve: (v: unknown) => void) =>
          Promise.resolve({ count: 0, error: null }).then(resolve)
        return chain
      }
      if (table === 'lesson_progress') {
        const chain: Record<string, unknown> = {}
        chain.select = vi.fn().mockReturnValue(chain)
        chain.eq = vi.fn().mockReturnValue(chain)
        chain.then = (resolve: (v: unknown) => void) =>
          Promise.resolve({ count: 0, error: null }).then(resolve)
        return chain
      }
      return {}
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getCourseProgress()

    expect(result).toEqual({ total: 0, completed: 0, percentage: 0 })
  })

  it('throws when not authenticated', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn(),
    }

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(getCourseProgress()).rejects.toThrow('Authentication required')
  })
})
