import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Unprotected route prefixes — these never require authentication.
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

/**
 * Public (marketing) pages served from the (public) route group.
 * Because (public) is a route group the URL segments don't include the
 * parenthesised folder name, so we match on the real URL paths.
 * The root "/" and any page not under /portal or /admin is implicitly public.
 */
function isPublicRoute(pathname: string): boolean {
  // Static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return true
  }

  // Explicitly unprotected prefixes
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true
  }

  // Everything that is NOT /portal/* or /admin/* is public
  if (!pathname.startsWith('/portal') && !pathname.startsWith('/admin')) {
    return true
  }

  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 1. Refresh the Supabase session (always, even for public routes) ──
  const { supabase, user, response } = await updateSession(request)

  // ── 2. Public routes — no auth required ──
  if (isPublicRoute(pathname)) {
    return response
  }

  // ── 2b. Setup wizard — accessible without auth (creates the first admin account) ──
  if (pathname === '/admin/setup' || pathname.startsWith('/admin/setup/')) {
    return response
  }

  // ── 3. All remaining routes require authentication ──
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── 4. Fetch profile to get role and setup status ──
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as string | undefined

  // ── 5. Portal routes — require 'customer' or 'admin' role ──
  if (pathname.startsWith('/portal')) {
    if (role !== 'customer' && role !== 'admin') {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return response
  }

  // ── 6. Admin routes — require 'admin' role ──
  if (pathname.startsWith('/admin')) {
    if (role !== 'admin') {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // All other /admin/* routes require setup to be complete
    const { data: siteConfig } = await supabase
      .from('site_config')
      .select('setup_complete')
      .eq('id', 1)
      .single()

    if (!siteConfig?.setup_complete) {
      return NextResponse.redirect(new URL('/admin/setup', request.url))
    }

    return response
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
