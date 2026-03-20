import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock dependencies BEFORE imports
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { captureLead, getLeads, updateLeadStatus, getLeadStats } from '@/actions/leads'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Helper: creates a mock Supabase client with auth + chainable query builder.
 * For admin-protected actions, configure auth.getUser and profiles query
 * to simulate an authenticated admin user.
 */
function createMockAdminAuthClient() {
  const profileSingle = vi.fn().mockResolvedValue({
    data: { role: 'admin' },
    error: null,
  })
  const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
  const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })

  const from = vi.fn()

  // Default: when called with 'profiles', return the auth chain
  from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return { select: profileSelect }
    }
    // Return a generic chainable for other tables
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
    _profileEq: profileEq,
  }
}

function createMockChain(terminalValue?: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const returnThis = () => chain
  chain.select = vi.fn(returnThis)
  chain.eq = vi.fn(returnThis)
  chain.neq = vi.fn(returnThis)
  chain.or = vi.fn(returnThis)
  chain.order = vi.fn(returnThis)
  chain.limit = vi.fn(returnThis)
  chain.range = vi.fn(returnThis)
  chain.gte = vi.fn(returnThis)
  chain.upsert = vi.fn(returnThis)
  chain.update = vi.fn(returnThis)
  chain.single = vi.fn().mockResolvedValue(
    terminalValue ?? { data: null, error: null }
  )
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// captureLead
// ---------------------------------------------------------------------------
describe('captureLead', () => {
  it('captures a lead with all fields', async () => {
    const mockLead = {
      id: 'lead-1',
      email: 'jane@example.com',
      name: 'Jane',
      source: 'landing-page',
      status: 'new',
    }
    const chain = createMockChain()
    chain.single.mockResolvedValue({ data: mockLead, error: null })

    const mockAdmin = { from: vi.fn().mockReturnValue(chain) }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as never)

    const result = await captureLead('jane@example.com', 'Jane', 'landing-page')

    expect(result).toEqual(mockLead)
    expect(mockAdmin.from).toHaveBeenCalledWith('leads')
    expect(chain.upsert).toHaveBeenCalledWith(
      {
        email: 'jane@example.com',
        name: 'Jane',
        source: 'landing-page',
        status: 'new',
      },
      { onConflict: 'email' }
    )
    expect(chain.select).toHaveBeenCalled()
    expect(chain.single).toHaveBeenCalled()
  })

  it('defaults source to "opt-in" when not provided', async () => {
    const chain = createMockChain()
    chain.single.mockResolvedValue({
      data: { id: 'lead-2', email: 'test@example.com', name: 'Test', source: 'opt-in', status: 'new' },
      error: null,
    })

    const mockAdmin = { from: vi.fn().mockReturnValue(chain) }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as never)

    await captureLead('test@example.com', 'Test')

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'opt-in' }),
      { onConflict: 'email' }
    )
  })

  it('sets name to null when not provided', async () => {
    const chain = createMockChain()
    chain.single.mockResolvedValue({
      data: { id: 'lead-3', email: 'anon@example.com', name: null, source: 'opt-in', status: 'new' },
      error: null,
    })

    const mockAdmin = { from: vi.fn().mockReturnValue(chain) }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as never)

    await captureLead('anon@example.com')

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: null, source: 'opt-in' }),
      { onConflict: 'email' }
    )
  })

  it('throws on database error', async () => {
    const chain = createMockChain()
    chain.single.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key violation' },
    })

    const mockAdmin = { from: vi.fn().mockReturnValue(chain) }
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as never)

    await expect(captureLead('bad@example.com')).rejects.toThrow(
      'Failed to capture lead: duplicate key violation'
    )
  })
})

// ---------------------------------------------------------------------------
// getLeads
// ---------------------------------------------------------------------------
describe('getLeads', () => {
  it('returns leads for admin user', async () => {
    const mockLeads = [
      { id: 'lead-1', email: 'a@example.com' },
      { id: 'lead-2', email: 'b@example.com' },
    ]

    const mockClient = createMockAdminAuthClient()

    // Build a chainable for leads query that resolves when awaited
    const leadsChain = createMockChain()
    // getLeads awaits the query directly (not .single()), so we make the chain thenable
    const queryResult = { data: mockLeads, error: null, count: 2 }
    // Override: the chain itself is awaited, so we add .then support
    ;(leadsChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      return Promise.resolve(queryResult).then(resolve)
    }

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return leadsChain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getLeads()

    expect(result).toEqual({ leads: mockLeads, count: 2 })
    expect(mockClient.from).toHaveBeenCalledWith('leads')
    expect(leadsChain.select).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(leadsChain.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('throws when not authenticated', async () => {
    const mockClient = createMockAdminAuthClient()
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(getLeads()).rejects.toThrow('Authentication required')
  })

  it('throws when not admin', async () => {
    const mockClient = createMockAdminAuthClient()
    mockClient._profileSingle.mockResolvedValue({
      data: { role: 'customer' },
      error: null,
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(getLeads()).rejects.toThrow('Admin access required')
  })

  it('applies status filter', async () => {
    const mockClient = createMockAdminAuthClient()

    const leadsChain = createMockChain()
    const queryResult = { data: [], error: null, count: 0 }
    ;(leadsChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      return Promise.resolve(queryResult).then(resolve)
    }

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return leadsChain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await getLeads({ status: 'qualified' })

    expect(leadsChain.eq).toHaveBeenCalledWith('status', 'qualified')
  })

  it('applies search filter with sanitization', async () => {
    const mockClient = createMockAdminAuthClient()

    const leadsChain = createMockChain()
    const queryResult = { data: [], error: null, count: 0 }
    ;(leadsChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      return Promise.resolve(queryResult).then(resolve)
    }

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return leadsChain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    // Search with special PostgREST chars that should be escaped
    await getLeads({ search: 'test%user' })

    // The % should be escaped to \%
    expect(leadsChain.or).toHaveBeenCalledWith(
      'email.ilike.%test\\%user%,name.ilike.%test\\%user%'
    )
  })

  it('applies pagination with limit and offset', async () => {
    const mockClient = createMockAdminAuthClient()

    const leadsChain = createMockChain()
    const queryResult = { data: [], error: null, count: 0 }
    ;(leadsChain as Record<string, unknown>).then = (resolve: (v: unknown) => void) => {
      return Promise.resolve(queryResult).then(resolve)
    }

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return leadsChain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await getLeads({ limit: 20, offset: 40 })

    expect(leadsChain.limit).toHaveBeenCalledWith(20)
    // range(offset, offset + limit - 1)
    expect(leadsChain.range).toHaveBeenCalledWith(40, 59)
  })
})

// ---------------------------------------------------------------------------
// updateLeadStatus
// ---------------------------------------------------------------------------
describe('updateLeadStatus', () => {
  it('updates lead status successfully', async () => {
    const updatedLead = {
      id: 'lead-1',
      email: 'test@example.com',
      status: 'converted',
    }

    const mockClient = createMockAdminAuthClient()

    const leadsChain = createMockChain()
    leadsChain.single.mockResolvedValue({ data: updatedLead, error: null })

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }
      return leadsChain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await updateLeadStatus('lead-1', 'converted')

    expect(result).toEqual(updatedLead)
    expect(mockClient.from).toHaveBeenCalledWith('leads')
    expect(leadsChain.update).toHaveBeenCalledWith({ status: 'converted' })
    expect(leadsChain.eq).toHaveBeenCalledWith('id', 'lead-1')
    expect(leadsChain.select).toHaveBeenCalled()
    expect(leadsChain.single).toHaveBeenCalled()
  })

  it('throws when not authenticated', async () => {
    const mockClient = createMockAdminAuthClient()
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(updateLeadStatus('lead-1', 'converted')).rejects.toThrow(
      'Authentication required'
    )
  })

  it('throws when not admin', async () => {
    const mockClient = createMockAdminAuthClient()
    mockClient._profileSingle.mockResolvedValue({
      data: { role: 'customer' },
      error: null,
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(updateLeadStatus('lead-1', 'converted')).rejects.toThrow(
      'Admin access required'
    )
  })
})

// ---------------------------------------------------------------------------
// getLeadStats
// ---------------------------------------------------------------------------
describe('getLeadStats', () => {
  it('returns all stat counts', async () => {
    const mockClient = createMockAdminAuthClient()

    // getLeadStats calls supabase.from('leads') 8 times via Promise.all.
    // Each call returns a chain that is thenable and resolves with { count, error }.
    let callIndex = 0
    const counts = [100, 30, 25, 20, 15, 10, 8, 45] // total, new, nurturing, qualified, converted, lost, thisWeek, thisMonth

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
        const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })
        return { select: profileSelect }
      }

      // For leads table, return a thenable chain
      const currentIndex = callIndex++
      const chain: Record<string, unknown> = {}
      const returnChain = () => chain
      chain.select = vi.fn(returnChain)
      chain.eq = vi.fn(returnChain)
      chain.gte = vi.fn(returnChain)
      chain.then = (resolve: (v: unknown) => void) => {
        return Promise.resolve({ count: counts[currentIndex], error: null }).then(resolve)
      }
      return chain
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getLeadStats()

    expect(result).toEqual({
      total: 100,
      new: 30,
      nurturing: 25,
      qualified: 20,
      converted: 15,
      lost: 10,
      thisWeek: 8,
      thisMonth: 45,
    })
  })

  it('throws when not authenticated', async () => {
    const mockClient = createMockAdminAuthClient()
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(getLeadStats()).rejects.toThrow('Authentication required')
  })
})
