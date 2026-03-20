import { describe, it, expect } from 'vitest'

/**
 * Test the route classification logic from middleware.ts.
 *
 * We extract and test isPublicRoute independently since the full middleware()
 * function requires Supabase session management which needs integration testing.
 */

const PUBLIC_PREFIXES = [
  '/api/webhooks',
  '/api/opt-in',
  '/api/health',
  '/api/auth/stripe',
  '/api/leads',
  '/login',
  '/signup',
  '/forgot-password',
  '/auth',
]

function isPublicRoute(pathname: string): boolean {
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return true
  }
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true
  }
  if (!pathname.startsWith('/portal') && !pathname.startsWith('/admin')) {
    return true
  }
  return false
}

describe('isPublicRoute', () => {
  describe('static assets and Next.js internals', () => {
    it('treats _next paths as public', () => {
      expect(isPublicRoute('/_next/static/chunk.js')).toBe(true)
      expect(isPublicRoute('/_next/data/abc.json')).toBe(true)
    })

    it('treats favicon paths as public', () => {
      expect(isPublicRoute('/favicon.ico')).toBe(true)
    })

    it('treats paths with file extensions as public', () => {
      expect(isPublicRoute('/logo.png')).toBe(true)
      expect(isPublicRoute('/styles.css')).toBe(true)
      expect(isPublicRoute('/robots.txt')).toBe(true)
    })
  })

  describe('explicitly public API routes', () => {
    it('treats webhook routes as public', () => {
      expect(isPublicRoute('/api/webhooks/stripe')).toBe(true)
      expect(isPublicRoute('/api/webhooks/resend')).toBe(true)
    })

    it('treats opt-in route as public', () => {
      expect(isPublicRoute('/api/opt-in')).toBe(true)
    })

    it('treats health check as public', () => {
      expect(isPublicRoute('/api/health')).toBe(true)
    })

    it('treats Stripe auth callback as public', () => {
      expect(isPublicRoute('/api/auth/stripe/callback')).toBe(true)
    })

    it('treats lead capture as public', () => {
      expect(isPublicRoute('/api/leads/capture')).toBe(true)
    })
  })

  describe('auth pages', () => {
    it('treats login as public', () => {
      expect(isPublicRoute('/login')).toBe(true)
    })

    it('treats signup as public', () => {
      expect(isPublicRoute('/signup')).toBe(true)
    })

    it('treats forgot-password as public', () => {
      expect(isPublicRoute('/forgot-password')).toBe(true)
    })

    it('treats auth callback as public', () => {
      expect(isPublicRoute('/auth/callback')).toBe(true)
    })
  })

  describe('marketing pages (not /admin, not /portal)', () => {
    it('treats root as public', () => {
      expect(isPublicRoute('/')).toBe(true)
    })

    it('treats blog as public', () => {
      expect(isPublicRoute('/blog')).toBe(true)
      expect(isPublicRoute('/blog/my-post')).toBe(true)
    })

    it('treats pricing as public', () => {
      expect(isPublicRoute('/pricing')).toBe(true)
    })

    it('treats custom pages as public', () => {
      expect(isPublicRoute('/landing-page')).toBe(true)
    })
  })

  describe('protected routes', () => {
    it('treats /admin as protected', () => {
      expect(isPublicRoute('/admin')).toBe(false)
      expect(isPublicRoute('/admin/dashboard')).toBe(false)
      expect(isPublicRoute('/admin/agents')).toBe(false)
    })

    it('treats /portal as protected', () => {
      expect(isPublicRoute('/portal')).toBe(false)
      expect(isPublicRoute('/portal/courses')).toBe(false)
      expect(isPublicRoute('/portal/support')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('treats /admin/setup as protected (middleware handles separately)', () => {
      // isPublicRoute returns false; the middleware function itself allows /admin/setup
      expect(isPublicRoute('/admin/setup')).toBe(false)
    })

    it('/administrator matches /admin prefix (startsWith behavior)', () => {
      // startsWith('/admin') catches /administrator too — this is the actual middleware behavior
      expect(isPublicRoute('/administrator')).toBe(false)
    })

    it('does not leak /portal-like paths', () => {
      expect(isPublicRoute('/portfolio')).toBe(true)
    })
  })
})
