'use client'

import { useState } from 'react'
import { checkStripeHealth } from '@/actions/setup'
import type { HealthCheckResult } from '@/types'
import { CheckCircle2, AlertCircle, Loader2, ExternalLink, CreditCard } from 'lucide-react'

export function ActivateStripe() {
  const [health, setHealth] = useState<HealthCheckResult | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  async function handleCheck() {
    setIsChecking(true)
    try {
      const result = await checkStripeHealth()
      setHealth(result)
    } catch {
      setHealth({ service: 'stripe', status: 'error', message: 'Check failed' })
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="rounded-lg border bg-white p-5">
      <div className="flex items-center gap-3">
        <CreditCard className="h-5 w-5 text-gray-600" />
        <h3 className="font-medium text-gray-900">Stripe — Payments</h3>
        {health?.status === 'connected' && (
          <span className="ml-auto flex items-center gap-1 text-xs font-medium text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Connected
          </span>
        )}
      </div>

      <div className="mt-3 rounded-md bg-gray-50 p-3">
        <p className="text-xs font-medium text-gray-700">Required Environment Variables</p>
        <ul className="mt-1.5 space-y-1 text-xs text-gray-600">
          <li><code className="rounded bg-gray-200 px-1 font-mono">STRIPE_SECRET_KEY</code></li>
          <li><code className="rounded bg-gray-200 px-1 font-mono">STRIPE_WEBHOOK_SECRET</code></li>
          <li><code className="rounded bg-gray-200 px-1 font-mono">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code></li>
        </ul>
        <a
          href="https://dashboard.stripe.com/apikeys"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          Open Stripe Dashboard <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {health?.status === 'not_configured' && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-700">
            Set the environment variables above, then redeploy.
          </p>
        </div>
      )}

      {health?.status === 'error' && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="text-xs text-red-700">{health.message}</p>
        </div>
      )}

      {health?.status !== 'connected' && (
        <button
          onClick={handleCheck}
          disabled={isChecking}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isChecking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isChecking ? 'Checking...' : 'Check Connection'}
        </button>
      )}
    </div>
  )
}
