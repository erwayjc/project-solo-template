import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock dependencies BEFORE imports
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/resend/client', () => ({
  resend: {
    emails: {
      send: vi.fn(),
    },
  },
}))

vi.mock('@/lib/resend/templates', () => ({
  buildBroadcastEmail: vi.fn().mockReturnValue({
    subject: 'Test Subject',
    html: '<p>Test</p>',
  }),
}))

import {
  getSequences,
  createSequence,
  updateSequence,
  deleteSequence,
  createBroadcast,
  sendBroadcast,
  updateBroadcast,
  deleteBroadcast,
  getEmailStats,
  getBroadcastRecipientCount,
  getSequenceSteps,
  getAllSequenceSteps,
  createSequenceStep,
  updateSequenceStep,
  deleteSequenceStep,
} from '@/actions/email'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend/client'

const mockUser = { id: 'user-1', email: 'admin@example.com' }

function createMockSupabaseClient() {
  const chainable = () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {}
    chain.select = vi.fn().mockReturnValue(chain)
    chain.insert = vi.fn().mockReturnValue(chain)
    chain.update = vi.fn().mockReturnValue(chain)
    chain.delete = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.contains = vi.fn().mockReturnValue(chain)
    chain.order = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
    return chain
  }

  const chains: Record<string, ReturnType<typeof chainable>> = {}

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockUser },
      }),
    },
    from: vi.fn((table: string) => {
      if (!chains[table]) {
        chains[table] = chainable()
      }
      return chains[table]
    }),
    _chain(table: string) {
      if (!chains[table]) {
        chains[table] = chainable()
      }
      return chains[table]
    },
  }
}

function setupAdminAuth(mock: ReturnType<typeof createMockSupabaseClient>) {
  const profileChain = mock._chain('profiles')
  profileChain.single.mockResolvedValue({
    data: { role: 'admin' },
    error: null,
  })
}

function setupNonAdminAuth(mock: ReturnType<typeof createMockSupabaseClient>) {
  const profileChain = mock._chain('profiles')
  profileChain.single.mockResolvedValue({
    data: { role: 'customer' },
    error: null,
  })
}

function setupUnauthenticated(mock: ReturnType<typeof createMockSupabaseClient>) {
  mock.auth.getUser.mockResolvedValue({
    data: { user: null },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Sequences ──

describe('getSequences', () => {
  it('returns sequences for authenticated user', async () => {
    const mockClient = createMockSupabaseClient()
    const seqChain = mockClient._chain('email_sequences')
    seqChain.order.mockResolvedValue({
      data: [
        { id: 'seq-1', name: 'Welcome' },
        { id: 'seq-2', name: 'Onboarding' },
      ],
      error: null,
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getSequences()

    expect(result).toEqual([
      { id: 'seq-1', name: 'Welcome' },
      { id: 'seq-2', name: 'Onboarding' },
    ])
    expect(mockClient.from).toHaveBeenCalledWith('email_sequences')
  })

  it('throws when not authenticated', async () => {
    const mockClient = createMockSupabaseClient()
    setupUnauthenticated(mockClient)
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(getSequences()).rejects.toThrow('Authentication required')
  })
})

describe('createSequence', () => {
  it('creates sequence as admin', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)
    const seqChain = mockClient._chain('email_sequences')
    seqChain.single.mockResolvedValue({
      data: { id: 'seq-new', name: 'New Sequence' },
      error: null,
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await createSequence({ name: 'New Sequence' })

    expect(result).toEqual({ id: 'seq-new', name: 'New Sequence' })
    expect(seqChain.insert).toHaveBeenCalledWith({ name: 'New Sequence' })
  })

  it('throws when not admin', async () => {
    const mockClient = createMockSupabaseClient()
    setupNonAdminAuth(mockClient)
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(createSequence({ name: 'Fail' })).rejects.toThrow('Admin access required')
  })
})

describe('updateSequence', () => {
  it('updates sequence as admin', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)
    const seqChain = mockClient._chain('email_sequences')
    seqChain.single.mockResolvedValue({
      data: { id: 'seq-1', name: 'Updated' },
      error: null,
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await updateSequence('seq-1', { name: 'Updated' })

    expect(result).toEqual({ id: 'seq-1', name: 'Updated' })
    expect(seqChain.update).toHaveBeenCalledWith({ name: 'Updated' })
  })
})

describe('deleteSequence', () => {
  it('deletes steps first, then sequence', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)

    // Steps deletion returns success, sequence deletion returns success
    const stepsChain = mockClient._chain('email_sequence_steps')
    stepsChain.eq.mockResolvedValue({ error: null })

    const seqChain = mockClient._chain('email_sequences')
    seqChain.eq.mockResolvedValue({ error: null })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await deleteSequence('seq-1')

    expect(mockClient.from).toHaveBeenCalledWith('email_sequence_steps')
    expect(mockClient.from).toHaveBeenCalledWith('email_sequences')
  })

  it('throws when step deletion fails', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)

    const stepsChain = mockClient._chain('email_sequence_steps')
    stepsChain.eq.mockResolvedValue({ error: { message: 'FK constraint' } })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(deleteSequence('seq-1')).rejects.toThrow('Failed to delete sequence steps')
  })
})

// ── Sequence Steps ──

describe('getSequenceSteps', () => {
  it('returns steps for a sequence as admin', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)
    const stepsChain = mockClient._chain('email_sequence_steps')
    stepsChain.order.mockResolvedValue({
      data: [{ id: 'step-1', step_number: 1 }],
      error: null,
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getSequenceSteps('seq-1')

    expect(result).toEqual([{ id: 'step-1', step_number: 1 }])
  })

  it('throws when not admin', async () => {
    const mockClient = createMockSupabaseClient()
    setupNonAdminAuth(mockClient)
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(getSequenceSteps('seq-1')).rejects.toThrow('Admin access required')
  })
})

describe('getAllSequenceSteps', () => {
  it('returns all steps ordered by step_number', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)
    const stepsChain = mockClient._chain('email_sequence_steps')
    stepsChain.order.mockResolvedValue({
      data: [
        { id: 'step-1', step_number: 1 },
        { id: 'step-2', step_number: 2 },
      ],
      error: null,
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getAllSequenceSteps()

    expect(result).toHaveLength(2)
    expect(stepsChain.order).toHaveBeenCalledWith('step_number', { ascending: true })
  })
})

describe('createSequenceStep', () => {
  it('creates a step as admin', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)
    const stepData = {
      sequence_id: 'seq-1',
      step_number: 1,
      subject: 'Welcome',
      body: 'Hello!',
      delay_hours: 0,
    }
    const stepsChain = mockClient._chain('email_sequence_steps')
    stepsChain.single.mockResolvedValue({
      data: { id: 'step-new', ...stepData },
      error: null,
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await createSequenceStep(stepData)

    expect(result).toEqual({ id: 'step-new', ...stepData })
    expect(stepsChain.insert).toHaveBeenCalledWith(stepData)
  })
})

describe('updateSequenceStep', () => {
  it('updates a step as admin', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)
    const stepsChain = mockClient._chain('email_sequence_steps')
    stepsChain.single.mockResolvedValue({
      data: { id: 'step-1', subject: 'Updated Subject' },
      error: null,
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await updateSequenceStep('step-1', { subject: 'Updated Subject' })

    expect(result).toEqual({ id: 'step-1', subject: 'Updated Subject' })
  })
})

describe('deleteSequenceStep', () => {
  it('deletes a step as admin', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)
    const stepsChain = mockClient._chain('email_sequence_steps')
    stepsChain.eq.mockResolvedValue({ error: null })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(deleteSequenceStep('step-1')).resolves.toBeUndefined()
  })
})

// ── Broadcasts ──

describe('createBroadcast', () => {
  it('sets status to scheduled when scheduled_for provided', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)
    const broadcastChain = mockClient._chain('broadcasts')
    broadcastChain.single.mockResolvedValue({
      data: { id: 'bc-1', status: 'scheduled', subject: 'Sale!' },
      error: null,
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await createBroadcast({
      subject: 'Sale!',
      body: 'Big sale today',
      scheduled_for: '2026-04-01T12:00:00Z',
    })

    expect(result.status).toBe('scheduled')
    expect(broadcastChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'scheduled' })
    )
  })

  it('sets status to draft when no scheduled_for', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)
    const broadcastChain = mockClient._chain('broadcasts')
    broadcastChain.single.mockResolvedValue({
      data: { id: 'bc-2', status: 'draft', subject: 'Draft' },
      error: null,
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await createBroadcast({
      subject: 'Draft',
      body: 'Draft body',
    })

    expect(result.status).toBe('draft')
    expect(broadcastChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft' })
    )
  })
})

describe('updateBroadcast', () => {
  it('updates successfully for draft broadcast', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)

    // Need separate chains for the two .from('broadcasts') calls:
    // 1st call fetches status, 2nd call does the update.
    // Since our mock reuses the same chain per table, we sequence the .single() calls.
    const broadcastChain = mockClient._chain('broadcasts')
    broadcastChain.single
      .mockResolvedValueOnce({ data: { status: 'draft' }, error: null }) // status check
      .mockResolvedValueOnce({ data: { id: 'bc-1', subject: 'Updated' }, error: null }) // update result

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await updateBroadcast('bc-1', { subject: 'Updated' })

    expect(result).toEqual({ id: 'bc-1', subject: 'Updated' })
  })

  it('throws when trying to edit sent broadcast', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)

    const broadcastChain = mockClient._chain('broadcasts')
    broadcastChain.single.mockResolvedValueOnce({
      data: { status: 'sent' },
      error: null,
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(updateBroadcast('bc-1', { subject: 'Nope' })).rejects.toThrow(
      'Cannot edit a broadcast that has been sent or is sending'
    )
  })

  it('throws when trying to edit sending broadcast', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)

    const broadcastChain = mockClient._chain('broadcasts')
    broadcastChain.single.mockResolvedValueOnce({
      data: { status: 'sending' },
      error: null,
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(updateBroadcast('bc-1', { subject: 'Nope' })).rejects.toThrow(
      'Cannot edit a broadcast that has been sent or is sending'
    )
  })
})

describe('deleteBroadcast', () => {
  it('deletes draft broadcast', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)

    // deleteBroadcast calls from('broadcasts') multiple times with different chain patterns.
    // Return a fresh chain per call to avoid conflicts.
    let broadcastCallCount = 0
    const originalFrom = mockClient.from
    mockClient.from = vi.fn((table: string) => {
      if (table === 'broadcasts') {
        broadcastCallCount++
        if (broadcastCallCount === 1) {
          // First call: .select('status').eq('id', id).single()
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { status: 'draft' }, error: null }),
              }),
            }),
          }
        }
        // Second call: .delete().eq('id', id)
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      return originalFrom(table)
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(deleteBroadcast('bc-1')).resolves.toBeUndefined()
  })

  it('throws when trying to delete sent broadcast', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)

    const broadcastChain = mockClient._chain('broadcasts')
    broadcastChain.single.mockResolvedValueOnce({
      data: { status: 'sent' },
      error: null,
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(deleteBroadcast('bc-1')).rejects.toThrow(
      'Cannot delete a broadcast that has been sent or is sending'
    )
  })
})

// ── sendBroadcast ──

describe('sendBroadcast', () => {
  function createMockAdminClient() {
    const chains: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {}

    const chainable = () => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {}
      chain.select = vi.fn().mockReturnValue(chain)
      chain.insert = vi.fn().mockResolvedValue({ error: null })
      chain.eq = vi.fn().mockReturnValue(chain)
      chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
      return chain
    }

    return {
      from: vi.fn((table: string) => {
        if (!chains[table]) {
          chains[table] = chainable()
        }
        return chains[table]
      }),
      _chain(table: string) {
        if (!chains[table]) {
          chains[table] = chainable()
        }
        return chains[table]
      },
    }
  }

  function setupSendBroadcastClient(broadcastData: Record<string, unknown> | null, broadcastError: Record<string, unknown> | null = null) {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)

    let broadcastCallCount = 0
    const originalFrom = mockClient.from
    mockClient.from = vi.fn((table: string) => {
      if (table === 'broadcasts') {
        broadcastCallCount++
        if (broadcastCallCount === 1) {
          // .select('*').eq('id', id).single() — fetch broadcast
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: broadcastData, error: broadcastError }),
              }),
            }),
          }
        }
        // Subsequent calls: .update(...).eq('id', id) — status updates
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      return originalFrom(table)
    })

    return mockClient
  }

  it('sends emails to all non-unsubscribed leads', async () => {
    const mockClient = setupSendBroadcastClient({ id: 'bc-1', subject: 'Hello', body: 'World' })

    // Site config
    const configChain = mockClient._chain('site_config')
    configChain.single.mockResolvedValue({
      data: { site_name: 'TestSite', legal_contact_email: 'info@test.com' },
      error: null,
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    // Admin client for leads + email_sends
    const mockAdmin = createMockAdminClient()
    const leadsChain = mockAdmin._chain('leads')
    leadsChain.eq.mockResolvedValue({
      data: [
        { email: 'lead1@test.com', name: 'Lead 1' },
        { email: 'lead2@test.com', name: 'Lead 2' },
      ],
      error: null,
    })
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as never)

    vi.mocked(resend.emails.send).mockResolvedValue({ data: { id: 'email-1' }, error: null } as never)

    const result = await sendBroadcast('bc-1')

    expect(result).toEqual({ sent: 2 })
    expect(resend.emails.send).toHaveBeenCalledTimes(2)
    expect(resend.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'TestSite <info@test.com>',
        to: 'lead1@test.com',
      })
    )
  })

  it('throws when broadcast not found', async () => {
    const mockClient = setupSendBroadcastClient(null, { message: 'Not found' })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(sendBroadcast('bc-missing')).rejects.toThrow('Broadcast not found')
  })

  it('logs failed sends but continues', async () => {
    const mockClient = setupSendBroadcastClient({ id: 'bc-1', subject: 'Hello', body: 'World' })

    const configChain = mockClient._chain('site_config')
    configChain.single.mockResolvedValue({
      data: { site_name: 'TestSite', legal_contact_email: 'info@test.com' },
      error: null,
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const mockAdmin = createMockAdminClient()
    const leadsChain = mockAdmin._chain('leads')
    leadsChain.eq.mockResolvedValue({
      data: [
        { email: 'fail@test.com', name: 'Fail' },
        { email: 'ok@test.com', name: 'OK' },
      ],
      error: null,
    })
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as never)

    // First send fails, second succeeds
    vi.mocked(resend.emails.send)
      .mockRejectedValueOnce(new Error('Send failed'))
      .mockResolvedValueOnce({ data: { id: 'email-2' }, error: null } as never)

    const result = await sendBroadcast('bc-1')

    expect(result).toEqual({ sent: 1 })
    // The failed send should log a 'bounced' entry
    const emailSendsChain = mockAdmin._chain('email_sends')
    expect(emailSendsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'bounced', recipient_email: 'fail@test.com' })
    )
  })
})

// ── Stats ──

describe('getEmailStats', () => {
  it('calculates correct rates', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)

    // The function calls supabase.from('email_sends').select('*', { count: 'exact', head: true })
    // and chains .eq('status', ...) for filtered counts.
    // Since all calls go through the same chain, we need to handle them via the eq mock.
    // The select method is called 6 times - need to return different chain objects per call
    // to allow different .eq() results. We'll mock at a higher level.
    // The actual code does 6 parallel calls via Promise.all, each starting from supabase.from('email_sends')
    // Since our mock returns the same chain for the same table, we need a different approach.

    // Override from to return fresh chains for email_sends
    let emailSendsCallCount = 0
    const emailSendsResults = [
      { count: 100, error: null }, // total
      { count: 40, error: null },  // sent
      { count: 30, error: null },  // delivered
      { count: 15, error: null },  // opened
      { count: 5, error: null },   // clicked
      { count: 10, error: null },  // bounced
    ]

    const originalFrom = mockClient.from
    mockClient.from = vi.fn((table: string) => {
      if (table === 'email_sends') {
        const chain: Record<string, ReturnType<typeof vi.fn>> = {}
        const result = emailSendsResults[emailSendsCallCount++]
        chain.select = vi.fn().mockReturnValue(chain)
        chain.eq = vi.fn().mockResolvedValue(result)
        // For the first call (total), there is no .eq(), so select resolves directly
        // Actually, the first call has no .eq() - it resolves from .select() via head:true
        // We need select to resolve if no eq is chained
        chain.select = vi.fn().mockReturnValue(chain)
        chain.eq = vi.fn().mockResolvedValue(result)
        // If no .eq() is called, the chain itself needs to resolve
        // The code: supabase.from('email_sends').select('*', { count: 'exact', head: true })
        // This returns a PromiseLike. For the total count (no .eq), the select result IS the result.
        // For filtered counts, .eq() is chained after select.
        // Simplest: make select return something that is both chainable and thenable
        const selectResult = {
          eq: vi.fn().mockResolvedValue(result),
          then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
          catch: (reject: (v: unknown) => void) => Promise.resolve(result).catch(reject),
        }
        chain.select = vi.fn().mockReturnValue(selectResult)
        return chain
      }
      return originalFrom(table)
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const stats = await getEmailStats()

    // totalDelivered = sent(40) + delivered(30) + opened(15) + clicked(5) = 90
    // totalOpened = opened(15) + clicked(5) = 20
    // openRate = round(20/90 * 100) = 22
    // clickRate = round(5/90 * 100) = 6
    expect(stats.totalSent).toBe(100)
    expect(stats.delivered).toBe(90)
    expect(stats.opened).toBe(20)
    expect(stats.clicked).toBe(5)
    expect(stats.bounced).toBe(10)
    expect(stats.openRate).toBe(22)
    expect(stats.clickRate).toBe(6)
  })

  it('returns 0 rates when no delivered emails', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)

    let emailSendsCallCount = 0
    const zeroResults = [
      { count: 0, error: null },
      { count: 0, error: null },
      { count: 0, error: null },
      { count: 0, error: null },
      { count: 0, error: null },
      { count: 0, error: null },
    ]

    const originalFrom = mockClient.from
    mockClient.from = vi.fn((table: string) => {
      if (table === 'email_sends') {
        const result = zeroResults[emailSendsCallCount++]
        const selectResult = {
          eq: vi.fn().mockResolvedValue(result),
          then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
          catch: (reject: (v: unknown) => void) => Promise.resolve(result).catch(reject),
        }
        return {
          select: vi.fn().mockReturnValue(selectResult),
        }
      }
      return originalFrom(table)
    })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const stats = await getEmailStats()

    expect(stats.openRate).toBe(0)
    expect(stats.clickRate).toBe(0)
    expect(stats.totalSent).toBe(0)
  })
})

// ── Recipient Count ──

describe('getBroadcastRecipientCount', () => {
  it('counts leads with filters applied', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)

    const leadsChain = mockClient._chain('leads')
    // After .eq('unsubscribed', false) then .eq('status', ...) then .eq('source', ...)
    // The terminal result needs count
    leadsChain.eq.mockReturnValue(leadsChain)
    leadsChain.contains.mockResolvedValue({ count: 42, error: null })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const count = await getBroadcastRecipientCount({
      status: 'active',
      source: 'landing_page',
      tags: ['vip'],
    })

    expect(count).toBe(42)
    expect(leadsChain.eq).toHaveBeenCalledWith('unsubscribed', false)
    expect(leadsChain.eq).toHaveBeenCalledWith('status', 'active')
    expect(leadsChain.eq).toHaveBeenCalledWith('source', 'landing_page')
    expect(leadsChain.contains).toHaveBeenCalledWith('tags', ['vip'])
  })

  it('counts all non-unsubscribed leads without filters', async () => {
    const mockClient = createMockSupabaseClient()
    setupAdminAuth(mockClient)

    const leadsChain = mockClient._chain('leads')
    leadsChain.eq.mockResolvedValue({ count: 100, error: null })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const count = await getBroadcastRecipientCount()

    expect(count).toBe(100)
  })
})
