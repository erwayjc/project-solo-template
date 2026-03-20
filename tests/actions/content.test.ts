import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock dependencies BEFORE imports
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import {
  getBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  checkBlogSlugAvailable,
  createSocialContent,
  approveSocialContent,
  rejectSocialContent,
  rescheduleSocialContent,
  getContentCalendar,
} from '@/actions/content'
import { createClient } from '@/lib/supabase/server'

// ── Helpers ──

const ADMIN_USER = { id: 'admin-1', email: 'admin@example.com' }
const REGULAR_USER = { id: 'user-1', email: 'user@example.com' }

function chainable() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.neq = vi.fn().mockReturnValue(chain)
  chain.contains = vi.fn().mockReturnValue(chain)
  chain.or = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.range = vi.fn().mockReturnValue(chain)
  chain.gte = vi.fn().mockReturnValue(chain)
  chain.lte = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  // Make the chain itself thenable so `await query` resolves
  chain.then = undefined as unknown as ReturnType<typeof vi.fn>
  return chain
}

/**
 * Build a mock Supabase client. `fromHandlers` maps table names to
 * functions that return a chainable query builder for that table.
 */
function createMockClient({
  user = ADMIN_USER as typeof ADMIN_USER | null,
  fromHandlers = {} as Record<string, () => ReturnType<typeof chainable>>,
} = {}) {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn((table: string) => {
      if (fromHandlers[table]) return fromHandlers[table]()
      return chainable()
    }),
  }
  return client
}

/** Shortcut: admin profile chain that resolves role='admin' */
function adminProfileChain() {
  const c = chainable()
  c.single.mockResolvedValue({ data: { role: 'admin' }, error: null })
  return c
}

/** Shortcut: non-admin profile chain */
function userProfileChain() {
  const c = chainable()
  c.single.mockResolvedValue({ data: { role: 'customer' }, error: null })
  return c
}

function useMock(client: ReturnType<typeof createMockClient>) {
  vi.mocked(createClient).mockResolvedValue(client as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Blog Posts ──

describe('getBlogPosts', () => {
  it('non-admin sees only published posts', async () => {
    const blogChain = chainable()
    // resolve the await on the query (no .single — it awaits the chain directly)
    blogChain.order.mockImplementation(() => {
      // Return a thenable that resolves to data
      const result = {
        ...blogChain,
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: [{ id: '1', status: 'published' }], error: null, count: 1 }),
      }
      return result
    })

    const client = createMockClient({
      user: REGULAR_USER,
      fromHandlers: {
        profiles: () => userProfileChain(),
        blog_posts: () => blogChain,
      },
    })
    useMock(client)

    await getBlogPosts()

    // Should have called eq with 'status', 'published'
    expect(blogChain.eq).toHaveBeenCalledWith('status', 'published')
  })

  it('admin sees all posts when no status filter given', async () => {
    const blogChain = chainable()
    blogChain.order.mockImplementation(() => ({
      ...blogChain,
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: [{ id: '1' }, { id: '2' }], error: null, count: 2 }),
    }))

    const client = createMockClient({
      user: ADMIN_USER,
      fromHandlers: {
        profiles: () => adminProfileChain(),
        blog_posts: () => blogChain,
      },
    })
    useMock(client)

    await getBlogPosts()

    // Admin without status filter: eq should NOT be called with 'status'
    const statusCalls = blogChain.eq.mock.calls.filter(
      (args: unknown[]) => args[0] === 'status'
    )
    expect(statusCalls).toHaveLength(0)
  })

  it('applies search filter with sanitization', async () => {
    const blogChain = chainable()
    blogChain.order.mockImplementation(() => ({
      ...blogChain,
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: [], error: null, count: 0 }),
    }))

    const client = createMockClient({
      user: ADMIN_USER,
      fromHandlers: {
        profiles: () => adminProfileChain(),
        blog_posts: () => blogChain,
      },
    })
    useMock(client)

    await getBlogPosts({ search: 'test%injection' })

    // The % should be escaped to \%
    expect(blogChain.or).toHaveBeenCalledWith(
      expect.stringContaining('test\\%injection')
    )
  })
})

// ── createBlogPost ──

describe('createBlogPost', () => {
  it('creates post with published_at when status is published', async () => {
    const blogChain = chainable()
    const createdPost = { id: 'post-1', title: 'Test', status: 'published', published_at: expect.any(String) }
    blogChain.single.mockResolvedValue({ data: createdPost, error: null })

    const client = createMockClient({
      fromHandlers: {
        profiles: () => adminProfileChain(),
        blog_posts: () => blogChain,
      },
    })
    useMock(client)

    const result = await createBlogPost({ title: 'Test', slug: 'test', status: 'published' })

    expect(blogChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test',
        slug: 'test',
        status: 'published',
        published_at: expect.any(String),
      })
    )
    expect(result).toEqual(createdPost)
  })

  it('creates draft without published_at', async () => {
    const blogChain = chainable()
    blogChain.single.mockResolvedValue({ data: { id: 'post-2', status: 'draft' }, error: null })

    const client = createMockClient({
      fromHandlers: {
        profiles: () => adminProfileChain(),
        blog_posts: () => blogChain,
      },
    })
    useMock(client)

    await createBlogPost({ title: 'Draft', slug: 'draft', status: 'draft' })

    expect(blogChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        published_at: null,
      })
    )
  })

  it('throws when not admin', async () => {
    const client = createMockClient({
      user: REGULAR_USER,
      fromHandlers: {
        profiles: () => userProfileChain(),
      },
    })
    useMock(client)

    await expect(
      createBlogPost({ title: 'Test', slug: 'test' })
    ).rejects.toThrow('Admin access required')
  })
})

// ── updateBlogPost ──

describe('updateBlogPost', () => {
  it('sets published_at only on first publish', async () => {
    // Two calls to blog_posts: first to check existing published_at, then to update
    let blogCallCount = 0
    const client = createMockClient({
      fromHandlers: {
        profiles: () => adminProfileChain(),
        blog_posts: () => {
          blogCallCount++
          const c = chainable()
          if (blogCallCount === 1) {
            // Existing post has no published_at
            c.single.mockResolvedValue({ data: { published_at: null }, error: null })
          } else {
            // The update result
            c.single.mockResolvedValue({
              data: { id: 'post-1', status: 'published', published_at: '2026-03-14T00:00:00Z' },
              error: null,
            })
          }
          return c
        },
      },
    })
    useMock(client)

    const result = await updateBlogPost('post-1', { status: 'published' })

    // The update call (2nd blog_posts call) should include published_at
    expect(result.published_at).toBeTruthy()
  })

  it('does not overwrite existing published_at', async () => {
    let blogCallCount = 0
    let updateChain: ReturnType<typeof chainable>
    const client = createMockClient({
      fromHandlers: {
        profiles: () => adminProfileChain(),
        blog_posts: () => {
          blogCallCount++
          const c = chainable()
          if (blogCallCount === 1) {
            // Already has published_at
            c.single.mockResolvedValue({ data: { published_at: '2026-01-01T00:00:00Z' }, error: null })
          } else {
            updateChain = c
            c.single.mockResolvedValue({
              data: { id: 'post-1', status: 'published', published_at: '2026-01-01T00:00:00Z' },
              error: null,
            })
          }
          return c
        },
      },
    })
    useMock(client)

    await updateBlogPost('post-1', { status: 'published' })

    // The update call should NOT include published_at since it was already set
    expect(updateChain!.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ published_at: expect.any(String) })
    )
  })
})

// ── checkBlogSlugAvailable ──

describe('checkBlogSlugAvailable', () => {
  it('returns true when slug is available', async () => {
    const blogChain = chainable()
    // select with head:true returns count, chain awaits directly
    delete (blogChain as Record<string, unknown>).then
    blogChain.eq.mockImplementation(() => ({
      ...blogChain,
      neq: blogChain.neq,
      then: (resolve: (v: unknown) => void) => resolve({ count: 0, error: null }),
    }))

    const client = createMockClient({
      user: REGULAR_USER,
      fromHandlers: {
        blog_posts: () => blogChain,
      },
    })
    useMock(client)

    const result = await checkBlogSlugAvailable('unique-slug')

    expect(result).toBe(true)
  })

  it('returns false when slug is taken', async () => {
    const blogChain = chainable()
    delete (blogChain as Record<string, unknown>).then
    blogChain.eq.mockImplementation(() => ({
      ...blogChain,
      neq: blogChain.neq,
      then: (resolve: (v: unknown) => void) => resolve({ count: 1, error: null }),
    }))

    const client = createMockClient({
      user: REGULAR_USER,
      fromHandlers: {
        blog_posts: () => blogChain,
      },
    })
    useMock(client)

    const result = await checkBlogSlugAvailable('taken-slug')

    expect(result).toBe(false)
  })
})

// ── deleteBlogPost ──

describe('deleteBlogPost', () => {
  it('deletes post successfully', async () => {
    const blogChain = chainable()
    delete (blogChain as Record<string, unknown>).then
    blogChain.eq.mockImplementation(() => ({
      ...blogChain,
      then: (resolve: (v: unknown) => void) => resolve({ error: null }),
    }))

    const client = createMockClient({
      fromHandlers: {
        profiles: () => adminProfileChain(),
        blog_posts: () => blogChain,
      },
    })
    useMock(client)

    await expect(deleteBlogPost('post-1')).resolves.toBeUndefined()
    expect(blogChain.delete).toHaveBeenCalled()
  })

  it('throws when not admin', async () => {
    const client = createMockClient({
      user: REGULAR_USER,
      fromHandlers: {
        profiles: () => userProfileChain(),
      },
    })
    useMock(client)

    await expect(deleteBlogPost('post-1')).rejects.toThrow('Admin access required')
  })
})

// ── Content Queue ──

describe('createSocialContent', () => {
  it('creates with status draft', async () => {
    const queueChain = chainable()
    queueChain.single.mockResolvedValue({
      data: { id: 'sq-1', platform: 'twitter', content: 'Hello', status: 'draft' },
      error: null,
    })

    const client = createMockClient({
      fromHandlers: {
        profiles: () => adminProfileChain(),
        content_queue: () => queueChain,
      },
    })
    useMock(client)

    const result = await createSocialContent({ platform: 'twitter', content: 'Hello' })

    expect(queueChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft', platform: 'twitter', content: 'Hello' })
    )
    expect(result.status).toBe('draft')
  })
})

describe('approveSocialContent / rejectSocialContent', () => {
  it('approveSocialContent sets status to approved', async () => {
    const queueChain = chainable()
    queueChain.single.mockResolvedValue({
      data: { id: 'sq-1', status: 'approved' },
      error: null,
    })

    const client = createMockClient({
      fromHandlers: {
        profiles: () => adminProfileChain(),
        content_queue: () => queueChain,
      },
    })
    useMock(client)

    const result = await approveSocialContent('sq-1')

    expect(queueChain.update).toHaveBeenCalledWith({ status: 'approved' })
    expect(result.status).toBe('approved')
  })

  it('rejectSocialContent sets status to draft', async () => {
    const queueChain = chainable()
    queueChain.single.mockResolvedValue({
      data: { id: 'sq-1', status: 'draft' },
      error: null,
    })

    const client = createMockClient({
      fromHandlers: {
        profiles: () => adminProfileChain(),
        content_queue: () => queueChain,
      },
    })
    useMock(client)

    const result = await rejectSocialContent('sq-1')

    expect(queueChain.update).toHaveBeenCalledWith({ status: 'draft' })
    expect(result.status).toBe('draft')
  })
})

// ── rescheduleSocialContent ──

describe('rescheduleSocialContent', () => {
  it('auto-approves drafts when rescheduling', async () => {
    const queueChain = chainable()
    queueChain.maybeSingle.mockResolvedValue({
      data: { id: 'sq-1', status: 'approved', scheduled_for: '2026-04-01T10:00:00Z' },
      error: null,
    })

    const client = createMockClient({
      fromHandlers: {
        profiles: () => adminProfileChain(),
        content_queue: () => queueChain,
      },
    })
    useMock(client)

    const result = await rescheduleSocialContent('sq-1', '2026-04-01T10:00:00Z')

    // First update attempt targets drafts with auto-approve
    expect(queueChain.update).toHaveBeenCalledWith({
      scheduled_for: '2026-04-01T10:00:00Z',
      status: 'approved',
    })
    expect(result.status).toBe('approved')
  })

  it('just updates schedule for non-drafts (fallback path)', async () => {
    let queueCallCount = 0
    const client = createMockClient({
      fromHandlers: {
        profiles: () => adminProfileChain(),
        content_queue: () => {
          queueCallCount++
          const c = chainable()
          if (queueCallCount === 1) {
            // Draft update returns null — not a draft
            c.maybeSingle.mockResolvedValue({ data: null, error: null })
          } else {
            // Fallback: just update schedule
            c.single.mockResolvedValue({
              data: { id: 'sq-1', status: 'approved', scheduled_for: '2026-05-01T10:00:00Z' },
              error: null,
            })
          }
          return c
        },
      },
    })
    useMock(client)

    const result = await rescheduleSocialContent('sq-1', '2026-05-01T10:00:00Z')

    expect(result.scheduled_for).toBe('2026-05-01T10:00:00Z')
  })
})

// ── getContentCalendar ──

describe('getContentCalendar', () => {
  it('returns both blog posts and social content in date range', async () => {
    const blogPosts = [{ id: 'bp-1', title: 'Post', published_at: '2026-03-10' }]
    const socialContent = [{ id: 'sq-1', platform: 'twitter', scheduled_for: '2026-03-12' }]

    const client = createMockClient({
      fromHandlers: {
        profiles: () => adminProfileChain(),
        blog_posts: () => {
          const c = chainable()
          c.order.mockImplementation(() => ({
            ...c,
            then: (resolve: (v: unknown) => void) =>
              resolve({ data: blogPosts, error: null }),
          }))
          return c
        },
        content_queue: () => {
          const c = chainable()
          c.order.mockImplementation(() => ({
            ...c,
            then: (resolve: (v: unknown) => void) =>
              resolve({ data: socialContent, error: null }),
          }))
          return c
        },
      },
    })
    useMock(client)

    const result = await getContentCalendar('2026-03-01', '2026-03-31')

    expect(result.blogPosts).toEqual(blogPosts)
    expect(result.socialContent).toEqual(socialContent)
  })
})
