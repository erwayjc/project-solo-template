import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock dependencies BEFORE imports
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import {
  getTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  reorderTestimonials,
  getMyTestimonialRequest,
  submitTestimonial,
  dismissTestimonialRequest,
} from '@/actions/testimonials'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function createMockChain(terminalValue?: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const returnThis = () => chain
  chain.select = vi.fn(returnThis)
  chain.eq = vi.fn(returnThis)
  chain.order = vi.fn(returnThis)
  chain.limit = vi.fn(returnThis)
  chain.insert = vi.fn(returnThis)
  chain.update = vi.fn(returnThis)
  chain.delete = vi.fn(returnThis)
  chain.single = vi.fn().mockResolvedValue(
    terminalValue ?? { data: null, error: null }
  )
  chain.maybeSingle = vi.fn().mockResolvedValue(
    terminalValue ?? { data: null, error: null }
  )
  return chain
}

function createMockAdminAuthClient() {
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
    _profileSingle: profileSingle,
  }
}

function createMockUnauthClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue(createMockChain()),
  }
}

function createMockCustomerAuthClient() {
  const profileSingle = vi.fn().mockResolvedValue({
    data: { role: 'customer' },
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
        data: { user: { id: 'user-2' } },
        error: null,
      }),
    },
    from,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// getTestimonials
// ---------------------------------------------------------------------------
describe('getTestimonials', () => {
  it('returns published testimonials without auth check when published=true', async () => {
    const testimonials = [
      { id: 't-1', name: 'Alice', quote: 'Great!', is_published: true, sort_order: 0 },
      { id: 't-2', name: 'Bob', quote: 'Amazing!', is_published: true, sort_order: 1 },
    ]

    const chain = createMockChain()
    // The query is awaited directly (not .single()), so make it thenable
    ;(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: testimonials, error: null }).then(resolve)

    const mockClient = {
      auth: { getUser: vi.fn() },
      from: vi.fn().mockReturnValue(chain),
    }

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getTestimonials({ published: true })

    expect(result).toEqual(testimonials)
    // Should NOT call auth.getUser for published filter
    expect(mockClient.auth.getUser).not.toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('is_published', true)
    expect(chain.order).toHaveBeenCalledWith('sort_order', { ascending: true })
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('requires admin for unpublished testimonials', async () => {
    const testimonials = [
      { id: 't-1', name: 'Alice', quote: 'Great!', is_published: false },
    ]

    const chain = createMockChain()
    ;(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: testimonials, error: null }).then(resolve)

    const mockClient = createMockAdminAuthClient()
    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return chain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getTestimonials()

    expect(result).toEqual(testimonials)
    expect(mockClient.auth.getUser).toHaveBeenCalled()
  })

  it('throws when non-admin tries to view all testimonials', async () => {
    const mockClient = createMockCustomerAuthClient()
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(getTestimonials()).rejects.toThrow('Admin access required')
  })
})

// ---------------------------------------------------------------------------
// createTestimonial
// ---------------------------------------------------------------------------
describe('createTestimonial', () => {
  it('creates testimonial with is_published=false', async () => {
    const newTestimonial = {
      id: 't-new',
      name: 'Alice',
      quote: 'Wonderful product!',
      role: 'CEO',
      is_published: false,
    }

    const chain = createMockChain()
    chain.single.mockResolvedValue({ data: newTestimonial, error: null })

    const mockClient = createMockAdminAuthClient()
    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return chain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await createTestimonial({ name: 'Alice', quote: 'Wonderful product!', role: 'CEO' })

    expect(result).toEqual(newTestimonial)
    expect(chain.insert).toHaveBeenCalledWith({
      name: 'Alice',
      quote: 'Wonderful product!',
      role: 'CEO',
      is_published: false,
    })
    expect(chain.select).toHaveBeenCalled()
    expect(chain.single).toHaveBeenCalled()
  })

  it('throws when not admin', async () => {
    const mockClient = createMockCustomerAuthClient()
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(
      createTestimonial({ name: 'Alice', quote: 'Great!' })
    ).rejects.toThrow('Admin access required')
  })
})

// ---------------------------------------------------------------------------
// updateTestimonial
// ---------------------------------------------------------------------------
describe('updateTestimonial', () => {
  it('updates testimonial successfully', async () => {
    const updated = { id: 't-1', name: 'Alice Updated', quote: 'Even better!', is_published: true }

    const chain = createMockChain()
    chain.single.mockResolvedValue({ data: updated, error: null })

    const mockClient = createMockAdminAuthClient()
    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return chain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await updateTestimonial('t-1', { name: 'Alice Updated', is_published: true })

    expect(result).toEqual(updated)
    expect(chain.update).toHaveBeenCalledWith({ name: 'Alice Updated', is_published: true })
    expect(chain.eq).toHaveBeenCalledWith('id', 't-1')
  })
})

// ---------------------------------------------------------------------------
// deleteTestimonial
// ---------------------------------------------------------------------------
describe('deleteTestimonial', () => {
  it('deletes testimonial successfully', async () => {
    const chain = createMockChain()
    // delete().eq() is awaited directly, so make it thenable
    ;(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ error: null }).then(resolve)

    const mockClient = createMockAdminAuthClient()
    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return chain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(deleteTestimonial('t-1')).resolves.toBeUndefined()
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 't-1')
  })
})

// ---------------------------------------------------------------------------
// reorderTestimonials
// ---------------------------------------------------------------------------
describe('reorderTestimonials', () => {
  it('updates sort_order for each testimonial', async () => {
    const orderedIds = ['t-3', 't-1', 't-2']
    const updateChains: ReturnType<typeof createMockChain>[] = []

    const mockClient = createMockAdminAuthClient()
    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      // Each from('testimonials') call returns a separate chain for the update
      const chain = createMockChain()
      // update().eq() is awaited, so make chain thenable
      ;(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
        Promise.resolve({ error: null }).then(resolve)
      updateChains.push(chain)
      return chain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await reorderTestimonials(orderedIds)

    // Should have created 3 update chains (one per ID)
    expect(updateChains).toHaveLength(3)
    expect(updateChains[0].update).toHaveBeenCalledWith({ sort_order: 0 })
    expect(updateChains[0].eq).toHaveBeenCalledWith('id', 't-3')
    expect(updateChains[1].update).toHaveBeenCalledWith({ sort_order: 1 })
    expect(updateChains[1].eq).toHaveBeenCalledWith('id', 't-1')
    expect(updateChains[2].update).toHaveBeenCalledWith({ sort_order: 2 })
    expect(updateChains[2].eq).toHaveBeenCalledWith('id', 't-2')
  })

  it('throws when any update fails', async () => {
    const orderedIds = ['t-1', 't-2']

    const mockClient = createMockAdminAuthClient()
    let callIndex = 0

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      const chain = createMockChain()
      const currentIndex = callIndex++
      ;(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
        if (currentIndex === 1) {
          return Promise.resolve({ error: { message: 'update failed' } }).then(resolve)
        }
        return Promise.resolve({ error: null }).then(resolve)
      }
      return chain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(reorderTestimonials(orderedIds)).rejects.toThrow(
      'Failed to reorder testimonials: update failed'
    )
  })
})

// ---------------------------------------------------------------------------
// getMyTestimonialRequest
// ---------------------------------------------------------------------------
describe('getMyTestimonialRequest', () => {
  it('returns pending request for authenticated user', async () => {
    const pendingRequest = {
      id: 'req-1',
      user_id: 'user-1',
      status: 'pending',
      created_at: '2026-01-01T00:00:00Z',
    }

    const chain = createMockChain()
    chain.maybeSingle.mockResolvedValue({ data: pendingRequest, error: null })

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue(chain),
    }

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getMyTestimonialRequest()

    expect(result).toEqual(pendingRequest)
    expect(mockClient.from).toHaveBeenCalledWith('testimonial_requests')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(chain.eq).toHaveBeenCalledWith('status', 'pending')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(chain.limit).toHaveBeenCalledWith(1)
    expect(chain.maybeSingle).toHaveBeenCalled()
  })

  it('returns null when not authenticated', async () => {
    const mockClient = createMockUnauthClient()
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getMyTestimonialRequest()

    expect(result).toBeNull()
    expect(mockClient.from).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// submitTestimonial
// ---------------------------------------------------------------------------
describe('submitTestimonial', () => {
  it('creates testimonial via admin client with user-provided name', async () => {
    const adminChain = createMockChain()
    ;(adminChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ error: null }).then(resolve)

    const mockAdminClient = { from: vi.fn().mockReturnValue(adminChain) }
    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never)

    const requestChain = createMockChain()
    ;(requestChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ error: null }).then(resolve)

    const profileSingle = vi.fn().mockResolvedValue({ data: { full_name: 'Jane Doe' }, error: null })
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return { select: profileSelect }
        return requestChain
      }),
    }

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await submitTestimonial({ quote: 'Love it!', name: 'Custom Name' })

    // Should use the provided name, not profile name
    expect(adminChain.insert).toHaveBeenCalledWith({
      name: 'Custom Name',
      quote: 'Love it!',
      is_published: false,
    })
    expect(mockAdminClient.from).toHaveBeenCalledWith('testimonials')
  })

  it('uses profile full_name when no name provided', async () => {
    const adminChain = createMockChain()
    ;(adminChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ error: null }).then(resolve)

    const mockAdminClient = { from: vi.fn().mockReturnValue(adminChain) }
    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never)

    const requestChain = createMockChain()
    ;(requestChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ error: null }).then(resolve)

    const profileSingle = vi.fn().mockResolvedValue({ data: { full_name: 'Jane Doe' }, error: null })
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return { select: profileSelect }
        return requestChain
      }),
    }

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await submitTestimonial({ quote: 'Love it!' })

    expect(adminChain.insert).toHaveBeenCalledWith({
      name: 'Jane Doe',
      quote: 'Love it!',
      is_published: false,
    })
  })

  it('falls back to Anonymous when neither name nor profile name provided', async () => {
    const adminChain = createMockChain()
    ;(adminChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ error: null }).then(resolve)

    const mockAdminClient = { from: vi.fn().mockReturnValue(adminChain) }
    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never)

    const requestChain = createMockChain()
    ;(requestChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ error: null }).then(resolve)

    const profileSingle = vi.fn().mockResolvedValue({ data: { full_name: null }, error: null })
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return { select: profileSelect }
        return requestChain
      }),
    }

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await submitTestimonial({ quote: 'Love it!' })

    expect(adminChain.insert).toHaveBeenCalledWith({
      name: 'Anonymous',
      quote: 'Love it!',
      is_published: false,
    })
  })

  it('updates request status to submitted', async () => {
    const adminChain = createMockChain()
    ;(adminChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ error: null }).then(resolve)

    const mockAdminClient = { from: vi.fn().mockReturnValue(adminChain) }
    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as never)

    const requestChain = createMockChain()
    ;(requestChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ error: null }).then(resolve)

    const profileSingle = vi.fn().mockResolvedValue({ data: { full_name: 'Jane' }, error: null })
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return { select: profileSelect }
        return requestChain
      }),
    }

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await submitTestimonial({ quote: 'Love it!', name: 'Jane' })

    // Verify testimonial_requests update
    expect(mockClient.from).toHaveBeenCalledWith('testimonial_requests')
    expect(requestChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'submitted' })
    )
    expect(requestChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(requestChain.eq).toHaveBeenCalledWith('status', 'pending')
  })

  it('throws when not authenticated', async () => {
    const mockClient = createMockUnauthClient()
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(
      submitTestimonial({ quote: 'Love it!' })
    ).rejects.toThrow('Authentication required')
  })
})

// ---------------------------------------------------------------------------
// dismissTestimonialRequest
// ---------------------------------------------------------------------------
describe('dismissTestimonialRequest', () => {
  it('updates request status to dismissed', async () => {
    const chain = createMockChain()
    ;(chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ error: null }).then(resolve)

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue(chain),
    }

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await dismissTestimonialRequest()

    expect(mockClient.from).toHaveBeenCalledWith('testimonial_requests')
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'dismissed' })
    )
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(chain.eq).toHaveBeenCalledWith('status', 'pending')
  })

  it('throws when not authenticated', async () => {
    const mockClient = createMockUnauthClient()
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(dismissTestimonialRequest()).rejects.toThrow('Authentication required')
  })
})
