'use client'

import { useState, useEffect } from 'react'
import { runMigration } from '@/actions/setup'
import { CheckCircle2, AlertCircle, Loader2, Database } from 'lucide-react'

interface StepDatabaseProps {
  onComplete: () => void
  isAlreadyComplete: boolean
}

export function StepDatabase({ onComplete, isAlreadyComplete }: StepDatabaseProps) {
  const [status, setStatus] = useState<'checking' | 'ready' | 'missing' | 'running' | 'done' | 'error'>('checking')
  const [tableInfo, setTableInfo] = useState<{ found: number; missing: number }>({ found: 0, missing: 0 })
  const [error, setError] = useState('')
  const [migrationResult, setMigrationResult] = useState<{ migrationsRun: number; seeded: boolean } | null>(null)

  useEffect(() => {
    if (isAlreadyComplete) {
      setStatus('ready')
      return
    }
    checkTables()
  }, [isAlreadyComplete])

  async function checkTables() {
    setStatus('checking')
    try {
      const result = await runMigration()
      setTableInfo({ found: result.tables.length, missing: result.missing.length })
      if (result.success) {
        setStatus('ready')
      } else {
        setStatus('missing')
      }
    } catch {
      setStatus('missing')
    }
  }

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
            {error.includes('DATABASE_URL') && (
              <p className="mt-2 text-sm text-red-700">
                Add <code className="rounded bg-red-100 px-1 font-mono text-xs">DATABASE_URL</code> to
                your Vercel environment variables. Find it in your Supabase Dashboard &gt; Settings
                &gt; Database &gt; Connection String (Transaction Pooler).
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
