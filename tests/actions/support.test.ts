import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock dependencies BEFORE imports
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import {
  createTicket,
  getTickets,
  respondToTicket,
  resolveTicket,
  getMyTickets,
} from '@/actions/support'
import { createClient } from '@/lib/supabase/server'

// Helper to build a chainable query mock that resolves to a given result
function chainable(result: Record<string, unknown>) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.range = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(result)
  // For queries that resolve without .single() (e.g. getMyTickets, getTickets)
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve)
  return chain
}

function createMockClient(overrides: { getUser?: unknown } = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      }),
      ...overrides,
    },
    from: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── createTicket ───────────────────────────────────────────────────────────

describe('createTicket', () => {
  it('creates a ticket with initial message', async () => {
    const mockTicket = {
      id: 'ticket-1',
      user_id: 'user-1',
      subject: 'Help me',
      messages: [{ role: 'customer', content: 'I need help', timestamp: expect.any(String) }],
      status: 'open',
    }

    const mockClient = createMockClient()
    const insertChain = chainable({ data: mockTicket, error: null })
    mockClient.from.mockReturnValue(insertChain)
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await createTicket('Help me', 'I need help')

    expect(result).toEqual(mockTicket)
    expect(mockClient.from).toHaveBeenCalledWith('support_tickets')
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        subject: 'Help me',
        status: 'open',
        messages: [
          expect.objectContaining({ role: 'customer', content: 'I need help' }),
        ],
      })
    )
    expect(insertChain.select).toHaveBeenCalled()
    expect(insertChain.single).toHaveBeenCalled()
  })

  it('throws when not authenticated', async () => {
    const mockClient = createMockClient({
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(createTicket('Help', 'msg')).rejects.toThrow('Authentication required')
  })

  it('throws on database error', async () => {
    const mockClient = createMockClient()
    const insertChain = chainable({ data: null, error: { message: 'DB failure' } })
    mockClient.from.mockReturnValue(insertChain)
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(createTicket('Help', 'msg')).rejects.toThrow('Failed to create ticket: DB failure')
  })
})

// ─── getTickets ─────────────────────────────────────────────────────────────

describe('getTickets', () => {
  function setupAdminClient() {
    const mockClient = createMockClient()

    // Build a query chain that acts as a thenable (for await without .single())
    const queryChain: Record<string, unknown> = {}
    queryChain.select = vi.fn().mockReturnValue(queryChain)
    queryChain.eq = vi.fn().mockReturnValue(queryChain)
    queryChain.order = vi.fn().mockReturnValue(queryChain)
    queryChain.limit = vi.fn().mockReturnValue(queryChain)
    queryChain.range = vi.fn().mockReturnValue(queryChain)
    queryChain.single = vi.fn()

    // Default resolved data for the query
    let queryResult = { data: [{ id: 'ticket-1' }], error: null, count: 1 }

    // Make the chain thenable so `await query` works
    queryChain.then = (resolve: (v: unknown) => void) =>
      Promise.resolve(queryResult).then(resolve)

    // Profile chain for admin check
    const profileChain = chainable({ data: { role: 'admin' }, error: null })

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      // support_tickets
      return queryChain
    })

    return { mockClient, queryChain, profileChain, setQueryResult: (r: typeof queryResult) => { queryResult = r } }
  }

  it('returns tickets for admin', async () => {
    const { mockClient } = setupAdminClient()
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getTickets()

    expect(result).toEqual({ tickets: [{ id: 'ticket-1' }], count: 1 })
  })

  it('applies status and priority filters', async () => {
    const { mockClient, queryChain } = setupAdminClient()
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await getTickets({ status: 'open', priority: 'high' })

    // eq should be called for both status and priority filters
    expect(queryChain.eq).toHaveBeenCalledWith('status', 'open')
    expect(queryChain.eq).toHaveBeenCalledWith('priority', 'high')
  })

  it('throws when not admin', async () => {
    const mockClient = createMockClient()
    const profileChain = chainable({ data: { role: 'customer' }, error: null })
    mockClient.from.mockReturnValue(profileChain)
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(getTickets()).rejects.toThrow('Admin access required')
  })
})

// ─── respondToTicket ────────────────────────────────────────────────────────

describe('respondToTicket', () => {
  function setupRespondClient(opts: {
    role: string
    existingMessages?: Record<string, unknown>[]
    ticketError?: { message: string } | null
  }) {
    const existingMessages = opts.existingMessages ?? [
      { role: 'customer', content: 'original', timestamp: '2024-01-01T00:00:00Z' },
    ]
    const existingTicket = {
      id: 'ticket-1',
      user_id: 'user-1',
      subject: 'Help',
      messages: existingMessages,
      status: 'open',
    }

    const updatedTicket = {
      ...existingTicket,
      messages: [
        ...existingMessages,
        { role: opts.role === 'admin' ? 'admin' : 'customer', content: 'reply', timestamp: expect.any(String) },
      ],
    }

    const mockClient = createMockClient()

    // We need from() to return different chains depending on the table and call sequence.
    // Call order: support_tickets (fetch), profiles, support_tickets (update)
    const fetchChain = chainable({
      data: opts.ticketError ? null : existingTicket,
      error: opts.ticketError ?? null,
    })
    const profileChain = chainable({ data: { role: opts.role }, error: null })
    const updateChain = chainable({ data: updatedTicket, error: null })

    let supportTicketCallCount = 0
    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      // support_tickets — first call is fetch, second is update
      supportTicketCallCount++
      if (supportTicketCallCount === 1) return fetchChain
      return updateChain
    })

    return { mockClient, fetchChain, profileChain, updateChain, updatedTicket }
  }

  it('admin can respond with admin message role', async () => {
    const { mockClient, updatedTicket } = setupRespondClient({ role: 'admin' })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await respondToTicket('ticket-1', 'reply')

    expect(result).toEqual(updatedTicket)
  })

  it('customer can respond with customer message role', async () => {
    const { mockClient, updatedTicket } = setupRespondClient({ role: 'customer' })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await respondToTicket('ticket-1', 'reply')

    expect(result).toEqual(updatedTicket)
  })

  it('appends message to existing messages array', async () => {
    const existingMessages = [
      { role: 'customer', content: 'first', timestamp: '2024-01-01T00:00:00Z' },
      { role: 'admin', content: 'second', timestamp: '2024-01-01T01:00:00Z' },
    ]
    const { mockClient, updateChain } = setupRespondClient({
      role: 'customer',
      existingMessages,
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await respondToTicket('ticket-1', 'reply')

    expect(updateChain.update).toHaveBeenCalledWith({
      messages: expect.arrayContaining([
        expect.objectContaining({ role: 'customer', content: 'first' }),
        expect.objectContaining({ role: 'admin', content: 'second' }),
        expect.objectContaining({ role: 'customer', content: 'reply' }),
      ]),
    })

    // Verify the array has exactly 3 messages
    const updateArg = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.messages).toHaveLength(3)
  })

  it('throws when ticket not found', async () => {
    const { mockClient } = setupRespondClient({
      role: 'admin',
      ticketError: { message: 'Not found' },
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(respondToTicket('bad-id', 'reply')).rejects.toThrow('Ticket not found')
  })
})

// ─── resolveTicket ──────────────────────────────────────────────────────────

describe('resolveTicket', () => {
  it('resolves ticket with timestamp', async () => {
    const resolvedTicket = {
      id: 'ticket-1',
      status: 'resolved',
      resolved_at: expect.any(String),
    }

    const mockClient = createMockClient()
    const profileChain = chainable({ data: { role: 'admin' }, error: null })
    const updateChain = chainable({ data: resolvedTicket, error: null })

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      return updateChain
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await resolveTicket('ticket-1')

    expect(result).toEqual(resolvedTicket)
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'resolved',
        resolved_at: expect.any(String),
      })
    )
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'ticket-1')
  })

  it('throws when not admin', async () => {
    const mockClient = createMockClient()
    const profileChain = chainable({ data: { role: 'customer' }, error: null })
    mockClient.from.mockReturnValue(profileChain)
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(resolveTicket('ticket-1')).rejects.toThrow('Admin access required')
  })
})

// ─── getMyTickets ───────────────────────────────────────────────────────────

describe('getMyTickets', () => {
  it('returns only the current user\'s tickets', async () => {
    const mockTickets = [
      { id: 'ticket-1', user_id: 'user-1', subject: 'My ticket' },
    ]

    const mockClient = createMockClient()

    const queryChain: Record<string, unknown> = {}
    queryChain.select = vi.fn().mockReturnValue(queryChain)
    queryChain.eq = vi.fn().mockReturnValue(queryChain)
    queryChain.order = vi.fn().mockReturnValue(queryChain)
    queryChain.then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: mockTickets, error: null }).then(resolve)

    mockClient.from.mockReturnValue(queryChain)
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getMyTickets()

    expect(result).toEqual(mockTickets)
    expect(mockClient.from).toHaveBeenCalledWith('support_tickets')
    expect(queryChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(queryChain.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('throws when not authenticated', async () => {
    const mockClient = createMockClient({
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(getMyTickets()).rejects.toThrow('Authentication required')
  })
})
