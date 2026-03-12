import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { leadCaptureSchema } from '@/lib/utils/validation'

export async function POST(request: NextRequest) {
  // F4: Wrap body parsing in try/catch to handle malformed requests gracefully
  let body: unknown
  const contentType = request.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      body = Object.fromEntries(formData.entries())
    } else {
      body = await request.json()
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }

  // Validate input
  const parsed = leadCaptureSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    )
  }

  const { email, name, source, page_slug, lead_magnet, funnel_step_id } = parsed.data
  const admin = createAdminClient()

  // Upsert lead with page_slug tracking
  const { data: lead, error } = await admin
    .from('leads')
    .upsert(
      {
        email,
        name: name || null,
        source: page_slug || source || 'custom-page',
        lead_magnet: lead_magnet || null,
        status: 'new',
        metadata: page_slug ? { page_slug } : {},
      },
      { onConflict: 'email' }
    )
    .select()
    .single()

  if (error) {
    console.error('Lead capture error:', error)
    return NextResponse.json(
      { error: 'Failed to capture lead' },
      { status: 500 }
    )
  }

  // Record funnel conversion event if funnel_step_id is provided
  if (funnel_step_id) {
    // Join through to funnels to verify the funnel is active
    const { data: funnelStep } = await admin
      .from('funnel_steps')
      .select('id, funnel_id, funnels!inner(status)')
      .eq('id', funnel_step_id)
      .eq('funnels.status', 'active')
      .single()

    if (funnelStep) {
      const ip = request.headers.get('x-forwarded-for') || 'unknown'
      const ua = request.headers.get('user-agent') || ''
      const visitorHash = crypto.createHash('sha256').update(ip + ua).digest('hex')

      admin
        .from('funnel_events')
        .insert({
          funnel_id: funnelStep.funnel_id,
          funnel_step_id: funnelStep.id,
          event_type: 'conversion',
          visitor_hash: visitorHash,
          lead_id: lead?.id || null,
        })
        .then(() => {})
    }
  }

  // Enroll in active opt_in sequences
  const { data: optInSequence } = await admin
    .from('email_sequences')
    .select('id')
    .eq('trigger', 'opt_in')
    .eq('is_active', true)
    .single()

  if (optInSequence) {
    await admin.from('sequence_enrollments').upsert(
      {
        email,
        sequence_id: optInSequence.id,
        current_step: 1,
        status: 'active',
        next_send_at: new Date().toISOString(),
      },
      { onConflict: 'email,sequence_id' }
    )
  }

  return NextResponse.json({ success: true, leadId: lead?.id })
}
