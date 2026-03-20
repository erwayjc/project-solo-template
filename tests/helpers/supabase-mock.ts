import { vi } from 'vitest'

/**
 * Creates a chainable mock Supabase client for testing server actions.
 *
 * Usage:
 *   const { supabase, setResult, setUser, setProfile } = createMockSupabase()
 *   vi.mocked(createClient).mockResolvedValue(supabase)
 *
 * Then configure responses:
 *   setUser({ id: 'user-1', email: 'test@test.com' })
 *   setProfile({ role: 'admin' })
 *   setResult({ data: [...], error: null })
 */

type MockResult = {
  data: unknown
  error: unknown
  count?: number | null
}

export function createMockSupabase() {
  let currentResult: MockResult = { data: null, error: null, count: null }
  let currentUser: { id: string; email?: string } | null = null
  let currentUserError: unknown = null
  let profileData: Record<string, unknown> | null = null
  let profileError: unknown = null

  // Track per-table results for cases where actions query multiple tables
  const tableResults = new Map<string, MockResult>()
  let currentTable = ''

  // Queue-based results for sequential calls on the same table
  const resultQueue: MockResult[] = []

  const chainable: Record<string, unknown> = {}

  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in', 'contains',
    'or', 'not', 'filter',
    'order', 'limit', 'range',
    'single', 'maybeSingle',
  ]

  const resolveResult = () => {
    // If there are queued results, use the next one
    if (resultQueue.length > 0) {
      return resultQueue.shift()!
    }
    // Check table-specific results
    if (currentTable && tableResults.has(currentTable)) {
      return tableResults.get(currentTable)!
    }
    return currentResult
  }

  // Most chain methods just return the chainable proxy
  for (const method of methods) {
    chainable[method] = vi.fn().mockImplementation(() => {
      // For terminal methods, resolve the result
      if (method === 'single' || method === 'maybeSingle') {
        const result = resolveResult()
        return Promise.resolve(result)
      }
      return chainable
    })
  }

  // Make the chainable itself thenable (for queries that don't end with .single())
  chainable.then = (resolve: (value: unknown) => void) => {
    const result = resolveResult()
    return Promise.resolve(result).then(resolve)
  }

  const mockAuth = {
    getUser: vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: { user: currentUser },
        error: currentUserError,
      })
    ),
    signInWithPassword: vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: { user: currentUser },
        error: currentUserError,
      })
    ),
    signUp: vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: { user: currentUser },
        error: currentUserError,
      })
    ),
    signOut: vi.fn().mockImplementation(() =>
      Promise.resolve({ error: currentUserError })
    ),
    resetPasswordForEmail: vi.fn().mockImplementation(() =>
      Promise.resolve({ error: currentUserError })
    ),
  }

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    currentTable = table

    // When querying 'profiles', return profile data on .single()
    if (table === 'profiles') {
      const profileChainable = { ...chainable }
      profileChainable.single = vi.fn().mockImplementation(() =>
        Promise.resolve({
          data: profileData,
          error: profileError,
        })
      )
      // Still allow chaining
      for (const method of methods) {
        if (method !== 'single') {
          profileChainable[method] = vi.fn().mockReturnValue(profileChainable)
        }
      }
      profileChainable.then = (resolve: (value: unknown) => void) => {
        return Promise.resolve({
          data: profileData,
          error: profileError,
        }).then(resolve)
      }
      return profileChainable
    }

    return chainable
  })

  const supabase = {
    auth: mockAuth,
    from: mockFrom,
  } as unknown as ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never

  return {
    supabase,
    mockAuth,
    mockFrom,
    chainable,

    /** Set the authenticated user returned by auth.getUser() */
    setUser(user: { id: string; email?: string } | null, error?: unknown) {
      currentUser = user
      currentUserError = error ?? null
    },

    /** Set the profile returned when querying the 'profiles' table */
    setProfile(profile: Record<string, unknown> | null, error?: unknown) {
      profileData = profile
      profileError = error ?? null
    },

    /** Set the default result for database queries */
    setResult(result: Partial<MockResult>) {
      currentResult = {
        data: result.data ?? null,
        error: result.error ?? null,
        count: result.count ?? null,
      }
    },

    /** Set a result for a specific table */
    setTableResult(table: string, result: Partial<MockResult>) {
      tableResults.set(table, {
        data: result.data ?? null,
        error: result.error ?? null,
        count: result.count ?? null,
      })
    },

    /** Queue results for sequential calls (consumed in order) */
    queueResult(result: Partial<MockResult>) {
      resultQueue.push({
        data: result.data ?? null,
        error: result.error ?? null,
        count: result.count ?? null,
      })
    },

    /** Set auth error for signIn/signUp/signOut/resetPassword */
    setAuthError(error: { message: string } | null) {
      currentUserError = error
    },

    /** Reset all state */
    reset() {
      currentResult = { data: null, error: null, count: null }
      currentUser = null
      currentUserError = null
      profileData = null
      profileError = null
      tableResults.clear()
      resultQueue.length = 0
      currentTable = ''
      vi.clearAllMocks()
    },
  }
}
