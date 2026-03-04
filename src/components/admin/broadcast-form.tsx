'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  createBroadcast,
  updateBroadcast,
  getBroadcastRecipientCount,
} from '@/actions/email'
import { FieldGroup } from '@/components/forms/field-group'
import { RichTextEditor } from '@/components/forms/rich-text-editor'
import { X } from 'lucide-react'
import type { Broadcast } from '@/types/database'

interface BroadcastFormProps {
  broadcast?: Broadcast
  onClose: () => void
  onSave: () => void
}

export function BroadcastForm({
  broadcast,
  onClose,
  onSave,
}: BroadcastFormProps) {
  const isEditing = !!broadcast
  const [subject, setSubject] = useState(broadcast?.subject ?? '')
  const [body, setBody] = useState(broadcast?.body ?? '')
  const [statusFilter, setStatusFilter] = useState<string>(
    (broadcast?.audience_filter as Record<string, unknown>)?.status as string ?? 'all'
  )
  const [sourceFilter, setSourceFilter] = useState<string>(
    (broadcast?.audience_filter as Record<string, unknown>)?.source as string ?? 'all'
  )
  const [tagsInput, setTagsInput] = useState<string>(
    ((broadcast?.audience_filter as Record<string, unknown>)?.tags as string[] ?? []).join(', ')
  )
  const [scheduleEnabled, setScheduleEnabled] = useState(!!broadcast?.scheduled_for)
  const [scheduledFor, setScheduledFor] = useState(broadcast?.scheduled_for ?? '')
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

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

  // Debounced recipient count
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const tags = tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
        const filter: Record<string, unknown> = {}
        if (statusFilter !== 'all') filter.status = statusFilter
        if (sourceFilter !== 'all') filter.source = sourceFilter
        if (tags.length > 0) filter.tags = tags
        const count = await getBroadcastRecipientCount(
          Object.keys(filter).length > 0 ? filter : undefined
        )
        setRecipientCount(count)
      } catch {
        setRecipientCount(null)
      }
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [statusFilter, sourceFilter, tagsInput])

  function buildAudienceFilter(): Record<string, unknown> | undefined {
    const filter: Record<string, unknown> = {}
    if (statusFilter !== 'all') filter.status = statusFilter
    if (sourceFilter !== 'all') filter.source = sourceFilter
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (tags.length > 0) filter.tags = tags
    return Object.keys(filter).length > 0 ? filter : undefined
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const audienceFilter = buildAudienceFilter()
      const scheduled = scheduleEnabled && scheduledFor ? scheduledFor : null

      if (isEditing) {
        await updateBroadcast(broadcast.id, {
          subject,
          body,
          audience_filter: audienceFilter ?? {},
          scheduled_for: scheduled,
        })
      } else {
        await createBroadcast({
          subject,
          body,
          audience_filter: audienceFilter,
          scheduled_for: scheduled ?? undefined,
        })
      }
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save broadcast')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Edit Broadcast' : 'New Broadcast'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Broadcast' : 'New Broadcast'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-4">
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <FieldGroup label="Subject" required>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Your broadcast subject"
            />
          </FieldGroup>

          <FieldGroup label="Body">
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Write your broadcast content..."
              minRows={8}
            />
          </FieldGroup>

          {/* Audience Filter */}
          <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Audience Filter
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <FieldGroup label="Status">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="all">All</option>
                  <option value="new">New</option>
                  <option value="nurturing">Nurturing</option>
                  <option value="qualified">Qualified</option>
                  <option value="converted">Converted</option>
                </select>
              </FieldGroup>

              <FieldGroup label="Source">
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="all">All</option>
                  <option value="organic">Organic</option>
                  <option value="referral">Referral</option>
                  <option value="ad">Ad</option>
                  <option value="api">API</option>
                </select>
              </FieldGroup>
            </div>

            <FieldGroup label="Tags" description="Comma-separated">
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="vip, early-adopter"
              />
            </FieldGroup>

            {recipientCount !== null && (
              <p className="text-sm text-gray-600">
                Estimated recipients:{' '}
                <span className="font-semibold">{recipientCount}</span>
              </p>
            )}
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(e) => setScheduleEnabled(e.target.checked)}
                className="rounded border-gray-300"
              />
              Schedule for later
            </label>
            {scheduleEnabled && (
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm"
              />
            )}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? 'Saving...'
                : isEditing
                  ? 'Save Changes'
                  : 'Create Broadcast'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
