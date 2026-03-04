'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  approveSocialContent,
  rejectSocialContent,
  deleteSocialContent,
  rescheduleSocialContent,
  updateSocialContent,
} from '@/actions/content'
import { cn } from '@/lib/utils/cn'
import { X } from 'lucide-react'
import type { ContentQueue } from '@/types/database'

interface ContentApprovalModalProps {
  item: ContentQueue
  onClose: () => void
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-800' },
  published: { label: 'Published', className: 'bg-blue-100 text-blue-800' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
}

export function ContentApprovalModal({
  item,
  onClose,
}: ContentApprovalModalProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(item.content)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [showReschedule, setShowReschedule] = useState(false)

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [handleEscape])

  async function handleAction(action: string) {
    setLoading(action)
    try {
      switch (action) {
        case 'approve':
          await approveSocialContent(item.id)
          break
        case 'reject':
          await rejectSocialContent(item.id)
          break
        case 'delete':
          if (!confirm('Are you sure you want to delete this content?')) {
            setLoading(null)
            return
          }
          await deleteSocialContent(item.id)
          break
        case 'reschedule':
          if (!rescheduleDate) return
          await rescheduleSocialContent(item.id, rescheduleDate)
          break
        case 'save-edit':
          await updateSocialContent(item.id, { content: editContent })
          setEditing(false)
          break
      }
      onClose()
    } catch (err) {
      console.error(`Action ${action} failed:`, err)
    } finally {
      setLoading(null)
    }
  }

  const badge = STATUS_BADGES[item.status] ?? {
    label: item.status,
    className: 'bg-gray-100 text-gray-800',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="mx-4 w-full max-w-lg rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {item.platform}
            </span>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium',
                badge.className
              )}
            >
              {badge.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-4">
          {/* Content */}
          {editing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full rounded-md border p-3 text-sm"
              rows={4}
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {item.content}
            </p>
          )}

          {/* Scheduled date */}
          {item.scheduled_for && (
            <p className="text-xs text-gray-500">
              Scheduled:{' '}
              {new Date(item.scheduled_for).toLocaleString()}
            </p>
          )}

          {/* Media URLs */}
          {item.media_urls && (item.media_urls as string[]).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Media:</p>
              {(item.media_urls as string[]).map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs text-blue-600 hover:underline"
                >
                  {url}
                </a>
              ))}
            </div>
          )}

          {/* Published info */}
          {item.status === 'published' && item.buffer_id && (
            <p className="text-xs text-gray-500">Buffer ID: {item.buffer_id}</p>
          )}

          {/* Reschedule input */}
          {showReschedule && (
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="rounded-md border px-3 py-1.5 text-sm"
              />
              <button
                onClick={() => handleAction('reschedule')}
                disabled={!rescheduleDate || loading === 'reschedule'}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading === 'reschedule' ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          {item.status === 'draft' && (
            <>
              <button
                onClick={() => setEditing(!editing)}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                {editing ? 'Cancel Edit' : 'Edit'}
              </button>
              {editing && (
                <button
                  onClick={() => handleAction('save-edit')}
                  disabled={loading === 'save-edit'}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading === 'save-edit' ? 'Saving...' : 'Save'}
                </button>
              )}
              <button
                onClick={() => handleAction('delete')}
                disabled={!!loading}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading === 'delete' ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => handleAction('approve')}
                disabled={!!loading}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                {loading === 'approve' ? 'Approving...' : 'Approve'}
              </button>
            </>
          )}

          {item.status === 'approved' && (
            <>
              <button
                onClick={() => handleAction('reject')}
                disabled={!!loading}
                className="rounded-md bg-yellow-600 px-3 py-1.5 text-sm text-white hover:bg-yellow-700 disabled:opacity-50"
              >
                {loading === 'reject' ? 'Rejecting...' : 'Reject to Draft'}
              </button>
              <button
                onClick={() => setShowReschedule(!showReschedule)}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Reschedule
              </button>
            </>
          )}

          {item.status === 'failed' && (
            <>
              <button
                onClick={() => handleAction('delete')}
                disabled={!!loading}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading === 'delete' ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => handleAction('approve')}
                disabled={!!loading}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                {loading === 'approve' ? 'Retry' : 'Retry'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
