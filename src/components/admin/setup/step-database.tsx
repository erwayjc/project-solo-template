'use client'

import { useState, useEffect, useCallback } from 'react'
import { runMigration } from '@/actions/setup'
import { createBrowserClient } from '@supabase/ssr'
import { CheckCircle2, AlertCircle, Loader2, Database } from 'lucide-react'

interface StepDatabaseProps {
  onComplete: () => void
  isAlreadyComplete: boolean
}

export function StepDatabase({ onComplete, isAlreadyComplete }: StepDatabaseProps) {
  const [status, setStatus] = useState<'checking' | 'ready' | 'missing' | 'running' | 'done' | 'error'>(isAlreadyComplete ? 'ready' : 'checking')
  const [tableInfo, setTableInfo] = useState<{ found: number; missing: number }>({ found: 0, missing: 0 })
  const [error, setError] = useState('')
  const [migrationResult, setMigrationResult] = useState<{ migrationsRun: number; seeded: boolean } | null>(null)

  useEffect(() => {
    if (isAlreadyComplete) return
    let cancelled = false
    runMigration().then((result) => {
      if (cancelled) return
      setTableInfo({ found: result.tables.length, missing: result.missing.length })
      setStatus(result.success ? 'ready' : 'missing')
    }).catch(() => {
      if (!cancelled) setStatus('missing')
    })
    return () => { cancelled = true }
  }, [isAlreadyComplete])

  async function handleRunMigration() {
    setStatus('running')
    setError('')
    try {
      const response = await fetch('/api/setup/migrate', { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Migration failed')
        setStatus('error')
        return
      }

      setMigrationResult({ migrationsRun: data.migrationsRun, seeded: data.seeded })
      setStatus('done')
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed')
      setStatus('error')
    }
  }

  if (status === 'checking') {
    return (
      <div className="flex items-center gap-3 p-4">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <p className="text-sm text-gray-600">Checking database tables...</p>
      </div>
    )
  }

  if (status === 'ready' || isAlreadyComplete) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <div>
          <p className="text-sm font-medium text-green-800">Database already configured</p>
          <p className="text-sm text-green-700">{tableInfo.found} tables found</p>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-800">Database setup complete!</p>
            {migrationResult && (
              <p className="text-sm text-green-700">
                {migrationResult.migrationsRun} migrations run
                {migrationResult.seeded ? ', sample data loaded' : ''}
              </p>
            )}
          </div>
        </div>
        <WorkerStatusPanel />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {status === 'missing' && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <Database className="mt-0.5 h-5 w-5 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {tableInfo.missing} tables need to be created
            </p>
            <p className="mt-1 text-sm text-amber-700">
              Click &quot;Run Setup&quot; to create your database tables and load sample data.
            </p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-800">Migration failed</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            {(error.includes('DATABASE_URL') || error.includes('POSTGRES_URL')) && (
              <p className="mt-2 text-sm text-red-700">
                Database connection not found. If you deployed via the Supabase Integration, try
                redeploying — the connection should be automatic. For manual setup, add{' '}
                <code className="rounded bg-red-100 px-1 font-mono text-xs">DATABASE_URL</code> to
                your Vercel environment variables (Supabase Dashboard &rarr; Connect &rarr; Connection
                String &rarr; Transaction Pooler).
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleRunMigration}
          disabled={status === 'running'}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === 'running' ? 'Running migrations...' : status === 'error' ? 'Retry' : 'Run Setup'}
        </button>
      </div>
    </div>
  )
}

const WORKER_SENTINEL_ID = '00000000-0000-0000-0000-000000000000'

function WorkerStatusPanel() {
  const [workerStatus, setWorkerStatus] = useState<'checking' | 'online' | 'offline' | 'unknown'>('unknown')

  const checkWorker = useCallback(async () => {
    setWorkerStatus('checking')
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
      )
      const { data } = await supabase
        .from('agent_status')
        .select('updated_at')
        .eq('agent_id', WORKER_SENTINEL_ID)
        .single()

      if (data && Date.now() - new Date(data.updated_at).getTime() < 2 * 60 * 1000) {
        setWorkerStatus('online')
      } else {
        setWorkerStatus('offline')
      }
    } catch {
      setWorkerStatus('offline')
    }
  }, [])

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 h-5 w-5 text-blue-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-800">Worker Service</p>
          <p className="mt-1 text-sm text-blue-700">
            Your agent worker runs as a separate Railway service. Check your Railway dashboard to verify both services are running.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={checkWorker}
              disabled={workerStatus === 'checking'}
              className="inline-flex items-center gap-2 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              {workerStatus === 'checking' && <Loader2 className="h-3 w-3 animate-spin" />}
              Check Worker
            </button>
            {workerStatus === 'online' && (
              <span className="inline-flex items-center gap-1 text-xs text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Worker online
              </span>
            )}
            {workerStatus === 'offline' && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                <AlertCircle className="h-3.5 w-3.5" /> Worker not detected — check Railway dashboard
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
