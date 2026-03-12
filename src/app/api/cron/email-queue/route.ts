import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/utils/cron'
import { processEmailQueue } from '@/lib/cron/email-queue'

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processEmailQueue()
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
