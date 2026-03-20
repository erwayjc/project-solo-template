import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { sanitizePageHtml } from '@/lib/utils/sanitize'

// F2: Added form-action and base-uri to prevent form hijacking and base tag injection
const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "form-action 'self'",
  "base-uri 'none'",
].join('; ')

function generateVisitorHash(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const ua = request.headers.get('user-agent') || ''
  return crypto.createHash('sha256').update(ip + ua).digest('hex')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const admin = createAdminClient()

  // Fetch the custom page
  const { data: page, error } = await admin
    .from('pages')
    .select('*')
    .eq('slug', slug)
    .eq('render_mode', 'custom')
    .single()

  if (error || !page) {
    return new Response('Not Found', { status: 404 })
  }

  // Draft/preview logic
  if (!page.is_published) {
    const url = new URL(request.url)
    const isPreview = url.searchParams.get('preview') === 'true'

    if (!isPreview) {
      return new Response('Not Found', { status: 404 })
    }

    // Verify admin session for preview
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Not Found', { status: 404 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return new Response('Not Found', { status: 404 })
    }
  } else {
    // F6: Atomic SQL increment — avoids TOCTOU race condition under concurrent traffic
    Promise.resolve(admin.rpc('increment_page_view_count' as never, { page_id: page.id } as never)).catch((err: unknown) => console.error('[page-view] Failed to increment:', err))
  }

  // Check if page belongs to a funnel step
  const { data: funnelStep } = await admin
    .from('funnel_steps')
    .select('id, funnel_id, step_type, step_order')
    .eq('page_id', page.id)
    .single()

  if (funnelStep) {
    const visitorHash = generateVisitorHash(request)

    // Fire-and-forget: record funnel view event
    admin
      .from('funnel_events')
      .insert({
        funnel_id: funnelStep.funnel_id,
        funnel_step_id: funnelStep.id,
        event_type: 'view',
        visitor_hash: visitorHash,
      })
      .then(() => {}, (err: unknown) => console.error('[funnel-event] Failed to record view:', err))

    // Upsell step verification
    if (funnelStep.step_type === 'upsell') {
      const url = new URL(request.url)
      const sessionId = url.searchParams.get('session_id')

      if (!sessionId) {
        // No session_id — redirect to previous step (sales page)
        const { data: prevStep } = await admin
          .from('funnel_steps')
          .select('page_id')
          .eq('funnel_id', funnelStep.funnel_id)
          .eq('step_order', funnelStep.step_order - 1)
          .single()

        if (prevStep) {
          const { data: prevPage } = await admin
            .from('pages')
            .select('slug')
            .eq('id', prevStep.page_id)
            .single()

          if (prevPage) {
            return Response.redirect(new URL(`/p/${prevPage.slug}`, request.url))
          }
        }
        return new Response('Not Found', { status: 404 })
      }

      // Verify Stripe checkout session
      try {
        const stripe = getStripe()
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['line_items.data.price'],
        })

        // Verify session payment status
        if (session.payment_status !== 'paid' && session.status !== 'complete') {
          // Session exists but not paid — could be an abandoned checkout
        }

        // Verify the session's product matches the preceding sales step's product
        const { data: salesStepForVerify } = await admin
          .from('funnel_steps')
          .select('product_id')
          .eq('funnel_id', funnelStep.funnel_id)
          .eq('step_order', funnelStep.step_order - 1)
          .single()

        if (salesStepForVerify?.product_id) {
          const lineItemPriceId = session.line_items?.data?.[0]?.price?.id
          if (lineItemPriceId) {
            const { data: expectedProduct } = await admin
              .from('products')
              .select('stripe_price_id')
              .eq('id', salesStepForVerify.product_id)
              .single()

            if (expectedProduct && expectedProduct.stripe_price_id !== lineItemPriceId) {
              // Session product doesn't match funnel — treat as invalid
              return new Response('Not Found', { status: 404 })
            }
          }
        }

        if (session.status !== 'complete') {
          // Not yet complete — show retry page with meta refresh
          const retryHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="3">
    <title>Confirming your purchase...</title>
    <style>
      body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
      .container { text-align: center; padding: 2rem; }
      .spinner { width: 40px; height: 40px; border: 3px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
      @keyframes spin { to { transform: rotate(360deg); } }
      h1 { font-size: 1.25rem; color: #111827; margin-bottom: 0.5rem; }
      p { color: #6b7280; font-size: 0.875rem; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="spinner"></div>
      <h1>Confirming your purchase...</h1>
      <p>This page will refresh automatically.</p>
    </div>
  </body>
</html>`
          return new Response(retryHtml, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Security-Policy': CSP_POLICY,
            },
          })
        }

        // Session complete — record conversion event for the preceding sales step
        const { data: salesStep } = await admin
          .from('funnel_steps')
          .select('id')
          .eq('funnel_id', funnelStep.funnel_id)
          .eq('step_order', funnelStep.step_order - 1)
          .single()

        if (salesStep) {
          admin
            .from('funnel_events')
            .insert({
              funnel_id: funnelStep.funnel_id,
              funnel_step_id: salesStep.id,
              event_type: 'conversion',
              visitor_hash: visitorHash,
              stripe_session_id: sessionId,
            })
            .then(() => {}, (err: unknown) => console.error('[funnel-event] Failed to record conversion:', err))
        }
      } catch {
        // Invalid session_id — redirect to previous step
        const { data: prevStep } = await admin
          .from('funnel_steps')
          .select('page_id')
          .eq('funnel_id', funnelStep.funnel_id)
          .eq('step_order', funnelStep.step_order - 1)
          .single()

        if (prevStep) {
          const { data: prevPage } = await admin
            .from('pages')
            .select('slug')
            .eq('id', prevStep.page_id)
            .single()

          if (prevPage) {
            return Response.redirect(new URL(`/p/${prevPage.slug}`, request.url))
          }
        }
        return new Response('Not Found', { status: 404 })
      }
    }
  }

  // Fetch brand colors + design tokens for CSS injection
  const { data: siteConfig } = await admin
    .from('site_config')
    .select('brand_colors, page_design_tokens')
    .eq('id', 1)
    .single()

  const brandColors = (siteConfig?.brand_colors as Record<string, string>) ?? {}
  const designTokens = (siteConfig?.page_design_tokens as Record<string, unknown>) ?? {}
  const fonts = (designTokens.fonts as Record<string, string>) ?? {}
  const customCss = (designTokens.custom_css as string) ?? ''

  const brandCssBlock = `<style>
    :root {
      --brand-primary: ${brandColors.primary ?? '#2563eb'};
      --brand-secondary: ${brandColors.secondary ?? '#1e40af'};
      --brand-accent: ${brandColors.accent ?? '#f59e0b'};
      --brand-background: ${brandColors.background ?? '#ffffff'};
      --brand-text: ${brandColors.text ?? '#111827'};
      --brand-font-heading: ${fonts.heading ?? 'system-ui, -apple-system, sans-serif'};
      --brand-font-body: ${fonts.body ?? 'system-ui, -apple-system, sans-serif'};
    }
    ${customCss}
  </style>`

  // Build SEO tags from seo JSONB
  const seo = (page.seo as Record<string, string>) ?? {}
  const title = seo.title || slug
  const description = seo.description || ''
  const ogImage = seo.og_image || ''
  const keywords = seo.keywords || ''

  const seoTags = [
    `<title>${escapeHtml(title)}</title>`,
    description ? `<meta name="description" content="${escapeAttr(description)}">` : '',
    keywords ? `<meta name="keywords" content="${escapeAttr(keywords)}">` : '',
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    description ? `<meta property="og:description" content="${escapeAttr(description)}">` : '',
    ogImage ? `<meta property="og:image" content="${escapeAttr(ogImage)}">` : '',
    `<meta property="og:type" content="website">`,
  ]
    .filter(Boolean)
    .join('\n    ')

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="${escapeAttr(CSP_POLICY)}">
    ${seoTags}
    ${brandCssBlock}
  </head>
  <body>
${sanitizePageHtml((page.html_content as string) || '')}
  </body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': CSP_POLICY,
    },
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
