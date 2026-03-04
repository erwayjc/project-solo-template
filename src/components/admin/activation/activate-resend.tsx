'use client'

import { useState } from 'react'
import { checkResendHealth } from '@/actions/setup'
import type { HealthCheckResult } from '@/types'
import { CheckCircle2, AlertCircle, Loader2, ExternalLink, Mail } from 'lucide-react'

export function ActivateResend() {
  const [health, setHealth] = useState<HealthCheckResult | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  async function handleCheck() {
    setIsChecking(true)
    try {
      const result = await checkResendHealth()
      setHealth(result)
    } catch {
      setHealth({ service: 'resend', status: 'error', message: 'Check failed' })
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="rounded-lg border bg-white p-5">
      <div className="flex items-center gap-3">
        <Mail className="h-5 w-5 text-gray-600" />
        <h3 className="font-medium text-gray-900">Resend — Email</h3>
        {health?.status === 'connected' && (
          <span className="ml-auto flex items-center gap-1 text-xs font-medium text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Connected
          </span>
        )}
      </div>

      <div className="mt-3 rounded-md bg-gray-50 p-3">
        <p className="text-xs font-medium text-gray-700">Required Environment Variable</p>
        <p className="mt-1.5 text-xs text-gray-600">
          <code className="rounded bg-gray-200 px-1 font-mono">RESEND_API_KEY</code>
        </p>
        <a
          href="https://resend.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          Open Resend Dashboard <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {health?.status === 'not_configured' && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-700">
            Set RESEND_API_KEY in your environment variables, then redeploy.
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
