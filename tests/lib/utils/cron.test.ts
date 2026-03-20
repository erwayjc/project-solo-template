import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock next/server before importing cron module
vi.mock('next/server', () => ({
  NextRequest: class {
    headers: Map<string, string>
    constructor(url: string, init?: { headers?: Record<string, string> }) {
      this.headers = new Map(Object.entries(init?.headers || {}))
    }
  },
}))

import { verifyCronSecret } from '@/lib/utils/cron'

// Create a minimal NextRequest-like object
function makeRequest(headers: Record<string, string> = {}) {
  return {
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
  } as Parameters<typeof verifyCronSecret>[0]
}

describe('verifyCronSecret', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    process.env.CRON_SECRET = 'my-cron-secret-123'
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('returns true for valid Bearer token', () => {
    const req = makeRequest({ authorization: 'Bearer my-cron-secret-123' })
    expect(verifyCronSecret(req)).toBe(true)
  })

  it('returns false when CRON_SECRET is not set', () => {
    delete process.env.CRON_SECRET
    const req = makeRequest({ authorization: 'Bearer anything' })
    expect(verifyCronSecret(req)).toBe(false)
  })

  it('returns false when authorization header is missing', () => {
    const req = makeRequest({})
    expect(verifyCronSecret(req)).toBe(false)
  })

  it('returns false for wrong secret', () => {
    const req = makeRequest({ authorization: 'Bearer wrong-secret' })
    expect(verifyCronSecret(req)).toBe(false)
  })

  it('returns false for different length tokens (timing-safe)', () => {
    const req = makeRequest({ authorization: 'Bearer short' })
    expect(verifyCronSecret(req)).toBe(false)
  })

  it('returns false without Bearer prefix', () => {
    const req = makeRequest({ authorization: 'my-cron-secret-123' })
    expect(verifyCronSecret(req)).toBe(false)
  })
})
