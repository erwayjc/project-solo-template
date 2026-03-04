'use client'

import { useState } from 'react'
import {
  getBroadcasts,
  sendBroadcast,
  deleteBroadcast,
} from '@/actions/email'
import { BroadcastForm } from '@/components/admin/broadcast-form'
import { Plus, Pencil, Trash2, Send, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Broadcast } from '@/types/database'

interface BroadcastsManagerProps {
  initialBroadcasts: Broadcast[]
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-blue-100 text-blue-800',
  sending: 'bg-amber-100 text-amber-800',
  sent: 'bg-green-100 text-green-800',
}

export function BroadcastsManager({
  initialBroadcasts,
}: BroadcastsManagerProps) {
  const [broadcasts, setBroadcasts] = useState(initialBroadcasts)
  const [showForm, setShowForm] = useState(false)
  const [editingBroadcast, setEditingBroadcast] = useState<Broadcast | null>(
    null
  )
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [statsId, setStatsId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refreshBroadcasts() {
    try {
      const fresh = await getBroadcasts()
      setBroadcasts(fresh)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh broadcasts')
    }
  }

  async function handleSend(id: string) {
    if (!confirm('Send this broadcast to all matching recipients now?')) return
    setSendingId(id)
    setError(null)
    try {
      await sendBroadcast(id)
      await refreshBroadcasts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send broadcast')
    } finally {
      setSendingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this broadcast?')) return
    setLoading(id)
    setError(null)
    try {
      await deleteBroadcast(id)
      setBroadcasts((prev) => prev.filter((b) => b.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete broadcast')
    } finally {
      setLoading(null)
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '\u2014'
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <>
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Broadcasts</h2>
        <button
          onClick={() => {
            setEditingBroadcast(null)
            setShowForm(true)
          }}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Broadcast
        </button>
      </div>

      {broadcasts.length === 0 ? (
        <div className="mt-4 rounded-lg border-2 border-dashed p-12 text-center">
          <p className="text-sm text-gray-500">No broadcasts yet.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Scheduled
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Sent
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {broadcasts.map((b) => {
                const stats = b.stats as Record<string, number> | null
                return (
                  <tr key={b.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {b.subject}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'rounded-full px-2 py-1 text-xs font-medium',
                          STATUS_STYLES[b.status] ?? 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(b.scheduled_for)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(b.sent_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(b.status === 'draft' || b.status === 'scheduled') && (
                          <>
                            <button
                              onClick={() => {
                                setEditingBroadcast(b)
                                setShowForm(true)
                              }}
                              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleSend(b.id)}
                              disabled={sendingId === b.id}
                              className="rounded-md p-1.5 text-blue-500 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                              title="Send Now"
                            >
                              {sendingId === b.id ? (
                                <span className="h-3.5 w-3.5 animate-spin">...</span>
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(b.id)}
                              disabled={loading === b.id}
                              className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {b.status === 'sent' && stats && (
                          <button
                            onClick={() =>
                              setStatsId(statsId === b.id ? null : b.id)
                            }
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="View Stats"
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {statsId === b.id && stats && (
                        <div className="mt-2 rounded-md bg-gray-50 p-2 text-left text-xs text-gray-600">
                          <div>Sent: {stats.sent ?? 0}</div>
                          <div>Delivered: {stats.delivered ?? 0}</div>
                          <div>Opened: {stats.opened ?? 0}</div>
                          <div>Clicked: {stats.clicked ?? 0}</div>
                          <div>Bounced: {stats.bounced ?? 0}</div>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <BroadcastForm
          broadcast={editingBroadcast ?? undefined}
          onClose={() => {
            setShowForm(false)
            setEditingBroadcast(null)
          }}
          onSave={() => {
            setShowForm(false)
            setEditingBroadcast(null)
            refreshBroadcasts()
          }}
        />
      )}
    </>
  )
}
