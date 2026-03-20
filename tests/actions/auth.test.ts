import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock dependencies BEFORE imports
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/utils/url', () => ({
  getSiteUrl: vi.fn().mockReturnValue('http://localhost:3000'),
}))

import { signIn, signUp, signOut, resetPassword, getCurrentUser } from '@/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

function createMockSupabaseClient(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      ...overrides,
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn(),
        }),
      }),
    }),
  }
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  vi.clearAllMocks()
})

describe('signIn', () => {
  it('returns user on successful login', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' }
    const mockClient = createMockSupabaseClient()
    mockClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await signIn('test@example.com', 'password123')

    expect(result).toEqual({ user: mockUser })
    expect(mockClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })
  })

  it('throws on auth error', async () => {
    const mockClient = createMockSupabaseClient()
    mockClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(signIn('test@example.com', 'wrong')).rejects.toThrow(
      'Invalid login credentials'
    )
  })
})

describe('signUp', () => {
  it('returns user on successful signup with full_name in metadata', async () => {
    const mockUser = {
      id: 'user-2',
      email: 'new@example.com',
      user_metadata: { full_name: 'Jane Doe' },
    }
    const mockClient = createMockSupabaseClient()
    mockClient.auth.signUp.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await signUp('new@example.com', 'password123', 'Jane Doe')

    expect(result).toEqual({ user: mockUser })
    expect(mockClient.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
      options: {
        data: {
          full_name: 'Jane Doe',
        },
      },
    })
  })

  it('throws on auth error', async () => {
    const mockClient = createMockSupabaseClient()
    mockClient.auth.signUp.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already registered' },
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(signUp('existing@example.com', 'pass', 'Test')).rejects.toThrow(
      'User already registered'
    )
  })
})

describe('signOut', () => {
  it('calls signOut then redirects to /login', async () => {
    const mockClient = createMockSupabaseClient()
    mockClient.auth.signOut.mockResolvedValue({ error: null })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await signOut()

    expect(mockClient.auth.signOut).toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('throws on signOut error', async () => {
    const mockClient = createMockSupabaseClient()
    mockClient.auth.signOut.mockResolvedValue({
      error: { message: 'Sign out failed' },
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(signOut()).rejects.toThrow('Sign out failed')
  })
})

describe('resetPassword', () => {
  it('calls resetPasswordForEmail with correct redirectTo', async () => {
    const mockClient = createMockSupabaseClient()
    mockClient.auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await resetPassword('test@example.com')

    expect(result).toEqual({ success: true })
    expect(mockClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'test@example.com',
      {
        redirectTo: 'http://localhost:3000/auth/callback?next=/reset-password',
      }
    )
  })

  it('throws on error', async () => {
    const mockClient = createMockSupabaseClient()
    mockClient.auth.resetPasswordForEmail.mockResolvedValue({
      error: { message: 'Rate limit exceeded' },
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(resetPassword('test@example.com')).rejects.toThrow(
      'Rate limit exceeded'
    )
  })
})

describe('getCurrentUser', () => {
  it('returns user with profile when authenticated', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' }
    const mockProfile = { id: 'user-1', role: 'customer', full_name: 'Test User' }
    const mockClient = createMockSupabaseClient()

    mockClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    const mockSingle = vi.fn().mockResolvedValue({
      data: mockProfile,
      error: null,
    })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockClient.from.mockReturnValue({ select: mockSelect })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getCurrentUser()

    expect(result).toEqual({ ...mockUser, profile: mockProfile })
    expect(mockClient.from).toHaveBeenCalledWith('profiles')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('returns null when not authenticated', async () => {
    const mockClient = createMockSupabaseClient()
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const result = await getCurrentUser()

    expect(result).toBeNull()
  })

  it('throws when profile fetch fails', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' }
    const mockClient = createMockSupabaseClient()

    mockClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })

    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Profile not found' },
    })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    mockClient.from.mockReturnValue({ select: mockSelect })

    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    await expect(getCurrentUser()).rejects.toThrow(
      'Failed to fetch profile: Profile not found'
    )
  })
})
