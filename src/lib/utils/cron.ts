import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

export function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = request.headers.get('authorization')
  if (!provided) return false
  const expected = `Bearer ${secret}`
  if (provided.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}
