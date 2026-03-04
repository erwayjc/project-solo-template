'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  createSequence,
  updateSequence,
  createSequenceStep,
  deleteSequenceStep,
} from '@/actions/email'
import { FieldGroup } from '@/components/forms/field-group'
import { RichTextEditor } from '@/components/forms/rich-text-editor'
import { X, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import type { EmailSequence, EmailSequenceStep } from '@/types/database'

interface StepFormData {
  id?: string
  _key: string
  subject: string
  body: string
  delay_hours: number
}

interface EmailSequenceFormProps {
  sequence?: EmailSequence & { steps: EmailSequenceStep[] }
  onClose: () => void
  onSave: () => void
}

export function EmailSequenceForm({
  sequence,
  onClose,
  onSave,
}: EmailSequenceFormProps) {
  const isEditing = !!sequence
  const [name, setName] = useState(sequence?.name ?? '')
  const [trigger, setTrigger] = useState(sequence?.trigger ?? 'opt_in')
  const [isActive, setIsActive] = useState(sequence?.is_active ?? false)
  const [steps, setSteps] = useState<StepFormData[]>(
    sequence?.steps.map((s) => ({
      id: s.id,
      _key: s.id,
      subject: s.subject,
      body: s.body,
      delay_hours: s.delay_hours,
    })) ?? []
  )
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { _key: crypto.randomUUID(), subject: '', body: '', delay_hours: 24 },
    ])
    setExpandedStep(steps.length)
  }

  function removeStep(index: number) {
    if (!window.confirm('Remove this step?')) return
    setSteps((prev) => prev.filter((_, i) => i !== index))
    setExpandedStep(null)
  }

  function moveStep(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= steps.length) return
    const updated = [...steps]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    setSteps(updated)
    setExpandedStep(newIndex)
  }

  function updateStep(index: number, field: keyof StepFormData, value: string | number) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isEditing) {
        await updateSequence(sequence.id, { name, trigger, is_active: isActive })
        // Create new steps first, then delete old ones (safer ordering)
        const oldStepIds = sequence.steps.map((s) => s.id)
        for (let i = 0; i < steps.length; i++) {
          await createSequenceStep({
            sequence_id: sequence.id,
            step_number: i,
            subject: steps[i].subject,
            body: steps[i].body,
            delay_hours: steps[i].delay_hours,
          })
        }
        // Only delete old steps after new ones are created successfully
        for (const stepId of oldStepIds) {
          await deleteSequenceStep(stepId)
        }
      } else {
        const created = await createSequence({ name, trigger, is_active: isActive })
        for (let i = 0; i < steps.length; i++) {
          await createSequenceStep({
            sequence_id: created.id,
            step_number: i,
            subject: steps[i].subject,
            body: steps[i].body,
            delay_hours: steps[i].delay_hours,
          })
        }
      }
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sequence')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Edit Sequence' : 'New Sequence'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Sequence' : 'New Sequence'}
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

          <FieldGroup label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Welcome Series"
            />
          </FieldGroup>

          <FieldGroup label="Trigger">
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="opt_in">Opt-In</option>
              <option value="purchase">Purchase</option>
              <option value="abandoned">Abandoned</option>
              <option value="reactivation">Reactivation</option>
              <option value="manual">Manual</option>
            </select>
          </FieldGroup>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-gray-300"
            />
            Active
          </label>

          {/* Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Steps ({steps.length})
              </h3>
              <button
                type="button"
                onClick={addStep}
                className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                <Plus className="h-3 w-3" />
                Add Step
              </button>
            </div>

            {steps.map((step, index) => (
              <div
                key={step._key}
                className="rounded-lg border bg-gray-50 p-4"
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedStep(expandedStep === index ? null : index)
                    }
                    className="flex items-center gap-2 text-sm font-medium text-gray-700"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                      {index + 1}
                    </span>
                    {step.subject || 'Untitled step'}
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveStep(index, 'up')}
                      disabled={index === 0}
                      className="rounded p-1 text-gray-400 hover:bg-gray-200 disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(index, 'down')}
                      disabled={index === steps.length - 1}
                      className="rounded p-1 text-gray-400 hover:bg-gray-200 disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {expandedStep === index && (
                  <div className="mt-3 space-y-3">
                    <FieldGroup label="Subject" required>
                      <input
                        type="text"
                        value={step.subject}
                        onChange={(e) =>
                          updateStep(index, 'subject', e.target.value)
                        }
                        required
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        placeholder="Email subject line"
                      />
                    </FieldGroup>

                    <FieldGroup label="Body">
                      <RichTextEditor
                        value={step.body}
                        onChange={(val) => updateStep(index, 'body', val)}
                        minRows={4}
                      />
                    </FieldGroup>

                    <FieldGroup
                      label="Delay"
                      description="Hours to wait after previous step"
                    >
                      <input
                        type="number"
                        value={step.delay_hours}
                        onChange={(e) =>
                          updateStep(
                            index,
                            'delay_hours',
                            parseInt(e.target.value) || 0
                          )
                        }
                        min={0}
                        className="w-32 rounded-md border px-3 py-2 text-sm"
                      />
                    </FieldGroup>
                  </div>
                )}
              </div>
            ))}

            {steps.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-4">
                No steps yet. Add your first step above.
              </p>
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
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Sequence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
