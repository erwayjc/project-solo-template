import { createHash, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

export function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = request.headers.get('authorization')
  if (!provided) return false
  const expected = `Bearer ${secret}`
  // Hash both values to fixed-length digests before comparison.
  // This avoids leaking the secret length through an early length check.
  const providedHash = createHash('sha256').update(provided).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(providedHash, expectedHash)
}
