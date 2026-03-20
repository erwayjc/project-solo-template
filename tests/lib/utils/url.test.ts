import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getSiteUrl } from '@/lib/utils/url'

describe('getSiteUrl', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    delete process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.RAILWAY_PUBLIC_DOMAIN
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('returns NEXT_PUBLIC_SITE_URL when set', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://my-site.com'
    expect(getSiteUrl()).toBe('https://my-site.com')
  })

  it('prefers NEXT_PUBLIC_SITE_URL over RAILWAY_PUBLIC_DOMAIN', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://my-site.com'
    process.env.RAILWAY_PUBLIC_DOMAIN = 'app.railway.app'
    expect(getSiteUrl()).toBe('https://my-site.com')
  })

  it('returns Railway domain with https when NEXT_PUBLIC_SITE_URL is not set', () => {
    process.env.RAILWAY_PUBLIC_DOMAIN = 'my-app.railway.app'
    expect(getSiteUrl()).toBe('https://my-app.railway.app')
  })

  it('falls back to localhost:3000 when no env vars are set', () => {
    expect(getSiteUrl()).toBe('http://localhost:3000')
  })
})
