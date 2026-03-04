'use client'

import { useState } from 'react'
import {
  getSequences,
  getAllSequenceSteps,
  updateSequence,
  deleteSequence,
} from '@/actions/email'
import { EmailSequenceForm } from '@/components/admin/email-sequence-form'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { EmailSequence, EmailSequenceStep } from '@/types/database'

type SequenceWithSteps = EmailSequence & { steps: EmailSequenceStep[] }

interface EmailSequencesManagerProps {
  initialSequences: SequenceWithSteps[]
}

export function EmailSequencesManager({
  initialSequences,
}: EmailSequencesManagerProps) {
  const [sequences, setSequences] = useState(initialSequences)
  const [showForm, setShowForm] = useState(false)
  const [editingSequence, setEditingSequence] =
    useState<SequenceWithSteps | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refreshSequences() {
    try {
      const [fresh, allSteps] = await Promise.all([
        getSequences(),
        getAllSequenceSteps(),
      ])
      const stepsBySeqId = new Map<string, typeof allSteps>()
      for (const step of allSteps) {
        const existing = stepsBySeqId.get(step.sequence_id) ?? []
        existing.push(step)
        stepsBySeqId.set(step.sequence_id, existing)
      }
      setSequences(
        fresh.map((seq) => ({ ...seq, steps: stepsBySeqId.get(seq.id) ?? [] }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh sequences')
    }
  }

  async function handleToggleActive(seq: SequenceWithSteps) {
    setLoading(seq.id)
    setError(null)
    try {
      await updateSequence(seq.id, { is_active: !seq.is_active })
      await refreshSequences()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle sequence')
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this sequence and all its steps?')) return
    setLoading(id)
    setError(null)
    try {
      await deleteSequence(id)
      setSequences((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sequence')
    } finally {
      setLoading(null)
    }
  }

  function handleEdit(seq: SequenceWithSteps) {
    setEditingSequence(seq)
    setShowForm(true)
  }

  return (
    <>
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Email Sequences
        </h2>
        <button
          onClick={() => {
            setEditingSequence(null)
            setShowForm(true)
          }}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Sequence
        </button>
      </div>

      {sequences.length === 0 ? (
        <div className="mt-4 rounded-lg border-2 border-dashed p-12 text-center">
          <p className="text-sm text-gray-500">No email sequences yet.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {sequences.map((seq) => (
            <div
              key={seq.id}
              className="rounded-lg border bg-white shadow-sm"
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(expandedId === seq.id ? null : seq.id)
                    }
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {expandedId === seq.id ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <div>
                    <h3 className="font-medium text-gray-900">{seq.name}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        {seq.trigger}
                      </span>
                      <span className="text-xs text-gray-500">
                        {seq.steps.length} step{seq.steps.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(seq)}
                    disabled={loading === seq.id}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                      seq.is_active
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {seq.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => handleEdit(seq)}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(seq.id)}
                    disabled={loading === seq.id}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {expandedId === seq.id && seq.steps.length > 0 && (
                <div className="border-t bg-gray-50 px-4 py-3">
                  <div className="space-y-2">
                    {seq.steps.map((step, i) => (
                      <div
                        key={step.id}
                        className="flex items-center gap-3 text-sm"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {i + 1}
                        </span>
                        <span className="text-gray-700">{step.subject}</span>
                        <span className="text-xs text-gray-400">
                          +{step.delay_hours}h
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <EmailSequenceForm
          sequence={editingSequence ?? undefined}
          onClose={() => {
            setShowForm(false)
            setEditingSequence(null)
          }}
          onSave={() => {
            setShowForm(false)
            setEditingSequence(null)
            refreshSequences()
          }}
        />
      )}
    </>
  )
}
