import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock dependencies BEFORE imports
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/utils/sanitize', () => ({
  sanitizePageHtml: vi.fn((html: string) => html),
}))

import {
  listPages,
  getPage,
  createPage,
  updatePage,
  deletePage,
  getPublishedWebsitePages,
} from '@/actions/pages'
import { createClient } from '@/lib/supabase/server'
import { sanitizePageHtml } from '@/lib/utils/sanitize'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a mock Supabase client authenticated as an admin user. */
function createMockAdminClient() {
  const profileSingle = vi.fn().mockResolvedValue({
    data: { role: 'admin' },
    error: null,
  })
  const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
  const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'profiles') {
      return { select: profileSelect }
    }
    return createMockChain()
  })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from,
  }
}

const testSeo = { title: 'Test', description: '', og_image: '', keywords: [] as string[] }
const seo = (title: string) => ({ title, description: '', og_image: '', keywords: [] as string[] })

/** Creates a mock Supabase client for a non-admin user. */
function createMockNonAdminClient() {
  const profileSingle = vi.fn().mockResolvedValue({
    data: { role: 'customer' },
    error: null,
  })
  const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
  const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-2' } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: profileSelect }
      }
      return createMockChain()
    }),
  }
}

/** Generic chainable query builder mock. */
function createMockChain(terminalValue?: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const returnThis = () => chain
  chain.select = vi.fn(returnThis)
  chain.insert = vi.fn(returnThis)
  chain.update = vi.fn(returnThis)
  chain.delete = vi.fn(returnThis)
  chain.eq = vi.fn(returnThis)
  chain.order = vi.fn(returnThis)
  chain.single = vi.fn().mockResolvedValue(
    terminalValue ?? { data: null, error: null }
  )
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Zod Validation (via createPage)
// ---------------------------------------------------------------------------
describe('Zod validation (via createPage)', () => {
  it('rejects reserved slugs', async () => {
    const reserved = ['admin', 'portal', 'api', 'home', 'blog']
    for (const slug of reserved) {
      await expect(
        createPage({
          slug,
          render_mode: 'sections',
          seo: testSeo,
          is_published: false,
        })
      ).rejects.toThrow()
    }
  })

  it('rejects invalid slug formats', async () => {
    const invalid = ['My Page', 'UPPER', 'special!chars', 'has spaces', 'a--b']
    for (const slug of invalid) {
      await expect(
        createPage({
          slug,
          render_mode: 'sections',
          seo: testSeo,
          is_published: false,
        })
      ).rejects.toThrow()
    }
  })

  it('rejects empty slug', async () => {
    await expect(
      createPage({
        slug: '',
        render_mode: 'sections',
        seo: testSeo,
        is_published: false,
      })
    ).rejects.toThrow()
  })

  it('accepts valid slug', async () => {
    const mock = createMockAdminClient()
    const pageData = {
      id: 'page-1',
      slug: 'my-landing-page',
      render_mode: 'sections',
      seo: testSeo,
      is_published: false,
    }

    const chain = createMockChain({ data: pageData, error: null })
    mock.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return chain
    })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await createPage({
      slug: 'my-landing-page',
      render_mode: 'sections',
      seo: testSeo,
      is_published: false,
    })

    expect(result).toEqual(pageData)
  })
})

// ---------------------------------------------------------------------------
// listPages
// ---------------------------------------------------------------------------
describe('listPages', () => {
  it('returns pages for admin user', async () => {
    const mock = createMockAdminClient()
    const pages = [
      { id: 'p1', slug: 'about', is_published: true, render_mode: 'sections' },
      { id: 'p2', slug: 'contact', is_published: false, render_mode: 'custom' },
    ]

    const chain = createMockChain()
    chain.order.mockResolvedValue({ data: pages, error: null })

    mock.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return chain
    })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await listPages()
    expect(result).toEqual(pages)
    expect(mock.from).toHaveBeenCalledWith('pages')
  })
})

// ---------------------------------------------------------------------------
// getPage
// ---------------------------------------------------------------------------
describe('getPage', () => {
  it('returns page by slug', async () => {
    const mock = createMockAdminClient()
    const page = { id: 'p1', slug: 'about', seo: { title: 'About' } }

    const chain = createMockChain()
    chain.single.mockResolvedValue({ data: page, error: null })

    mock.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return chain
    })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await getPage('about')
    expect(result).toEqual(page)
  })

  it('returns null when page not found (PGRST116)', async () => {
    const mock = createMockAdminClient()

    const chain = createMockChain()
    chain.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    })

    mock.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return chain
    })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await getPage('nonexistent')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// createPage
// ---------------------------------------------------------------------------
describe('createPage', () => {
  it('creates a sections page successfully', async () => {
    const mock = createMockAdminClient()
    const pageData = {
      id: 'p1',
      slug: 'features',
      render_mode: 'sections',
      seo: { title: 'Features' },
      is_published: false,
      sections: [],
    }

    const chain = createMockChain()
    chain.single.mockResolvedValue({ data: pageData, error: null })

    mock.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return chain
    })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await createPage({
      slug: 'features',
      render_mode: 'sections',
      seo: seo('Features'),
      is_published: false,
      sections: [],
    })

    expect(result).toEqual(pageData)
  })

  it('creates a custom page with html_content sanitization', async () => {
    const mock = createMockAdminClient()
    const pageData = {
      id: 'p2',
      slug: 'custom-page',
      render_mode: 'custom',
      seo: { title: 'Custom' },
      html_content: '<p>Hello</p>',
    }

    const chain = createMockChain()
    chain.single.mockResolvedValue({ data: pageData, error: null })

    mock.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return chain
    })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    await createPage({
      slug: 'custom-page',
      render_mode: 'custom',
      seo: seo('Custom'),
      is_published: false,
      html_content: '<p>Hello</p>',
    })

    expect(sanitizePageHtml).toHaveBeenCalledWith('<p>Hello</p>')
  })

  it('throws on duplicate slug (error code 23505)', async () => {
    const mock = createMockAdminClient()

    const chain = createMockChain()
    chain.single.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate' },
    })

    mock.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return chain
    })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    await expect(
      createPage({
        slug: 'existing-page',
        render_mode: 'sections',
        seo: seo('Dup'),
        is_published: false,
      })
    ).rejects.toThrow('A page with this slug already exists')
  })

  it('throws when not admin', async () => {
    const mock = createMockNonAdminClient()
    vi.mocked(createClient).mockResolvedValue(mock as never)

    await expect(
      createPage({
        slug: 'test-page',
        render_mode: 'sections',
        seo: testSeo,
        is_published: false,
      })
    ).rejects.toThrow('Admin access required')
  })
})

// ---------------------------------------------------------------------------
// updatePage
// ---------------------------------------------------------------------------
describe('updatePage', () => {
  it('updates seo and is_published', async () => {
    const mock = createMockAdminClient()
    const updatedPage = {
      id: 'p1',
      slug: 'about',
      seo: { title: 'Updated About' },
      is_published: true,
      render_mode: 'sections',
    }

    // Track call count to distinguish fetch vs update
    let callCount = 0
    mock.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      if (table === 'pages') {
        callCount++
        if (callCount === 1) {
          // First call: fetch existing page
          return createMockChain({
            data: { render_mode: 'sections', html_content: null },
            error: null,
          })
        }
        // Second call: update
        return createMockChain({ data: updatedPage, error: null })
      }
      return createMockChain()
    })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await updatePage('about', {
      seo: seo('Updated About'),
      is_published: true,
    })

    expect(result).toEqual(updatedPage)
  })

  it('saves html_content_previous for custom pages', async () => {
    const mock = createMockAdminClient()

    let callCount = 0
    let capturedUpdateChain: ReturnType<typeof createMockChain> | null = null

    mock.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      if (table === 'pages') {
        callCount++
        if (callCount === 1) {
          // Fetch: existing custom page with html_content
          return createMockChain({
            data: { render_mode: 'custom', html_content: '<p>Old content</p>' },
            error: null,
          })
        }
        // Update call
        capturedUpdateChain = createMockChain({
          data: { id: 'p1', slug: 'custom', html_content: '<p>New content</p>' },
          error: null,
        })
        return capturedUpdateChain
      }
      return createMockChain()
    })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    await updatePage('custom', {
      html_content: '<p>New content</p>',
    })

    // Verify update was called with html_content_previous
    expect(capturedUpdateChain!.update).toHaveBeenCalled()
    const updateArg = capturedUpdateChain!.update.mock.calls[0][0]
    expect(updateArg.html_content_previous).toBe('<p>Old content</p>')
    expect(sanitizePageHtml).toHaveBeenCalledWith('<p>New content</p>')
  })

  it('does not update html_content for sections pages', async () => {
    const mock = createMockAdminClient()

    let callCount = 0
    let capturedUpdateChain: ReturnType<typeof createMockChain> | null = null

    mock.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      if (table === 'pages') {
        callCount++
        if (callCount === 1) {
          return createMockChain({
            data: { render_mode: 'sections', html_content: null },
            error: null,
          })
        }
        capturedUpdateChain = createMockChain({
          data: { id: 'p1', slug: 'sections-page' },
          error: null,
        })
        return capturedUpdateChain
      }
      return createMockChain()
    })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    await updatePage('sections-page', {
      html_content: '<p>Should be ignored</p>',
    })

    const updateArg = capturedUpdateChain!.update.mock.calls[0][0]
    expect(updateArg.html_content).toBeUndefined()
    expect(updateArg.html_content_previous).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// deletePage
// ---------------------------------------------------------------------------
describe('deletePage', () => {
  it('deletes page successfully', async () => {
    const mock = createMockAdminClient()

    let callCount = 0
    mock.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      if (table === 'pages') {
        callCount++
        if (callCount === 1) {
          // Fetch page id
          return createMockChain({ data: { id: 'page-1' }, error: null })
        }
        // Delete call
        const chain = createMockChain()
        chain.eq.mockResolvedValue({ error: null })
        return chain
      }
      if (table === 'funnel_steps') {
        // No funnel references
        const chain = createMockChain()
        chain.eq.mockResolvedValue({ count: 0 })
        return chain
      }
      return createMockChain()
    })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    await expect(deletePage('about')).resolves.toBeUndefined()
  })

  it('throws when page is used in a funnel', async () => {
    const mock = createMockAdminClient()

    mock.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      if (table === 'pages') {
        return createMockChain({ data: { id: 'page-1' }, error: null })
      }
      if (table === 'funnel_steps') {
        // Funnel references exist
        const chain = createMockChain()
        chain.eq.mockResolvedValue({ count: 2 })
        return chain
      }
      return createMockChain()
    })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    await expect(deletePage('about')).rejects.toThrow(
      'Cannot delete this page — it is used in a funnel'
    )
  })
})

// ---------------------------------------------------------------------------
// getPublishedWebsitePages
// ---------------------------------------------------------------------------
describe('getPublishedWebsitePages', () => {
  it('returns published pages without auth', async () => {
    const pages = [
      { slug: 'about', seo: { title: 'About Us' }, render_mode: 'sections' },
      { slug: 'faq', seo: { title: 'FAQ' }, render_mode: 'custom' },
    ]

    const chain = createMockChain()
    chain.order.mockResolvedValue({ data: pages, error: null })

    const mock = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn().mockReturnValue(chain),
    }

    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await getPublishedWebsitePages()
    expect(result).toEqual([
      { slug: 'about', title: 'About Us', render_mode: 'sections' },
      { slug: 'faq', title: 'FAQ', render_mode: 'custom' },
    ])
  })

  it('returns empty array on error', async () => {
    const chain = createMockChain()
    chain.order.mockResolvedValue({
      data: null,
      error: { message: 'connection error' },
    })

    const mock = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn().mockReturnValue(chain),
    }

    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await getPublishedWebsitePages()
    expect(result).toEqual([])
  })
})
