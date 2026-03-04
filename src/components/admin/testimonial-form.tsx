'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  createTestimonial,
  updateTestimonial,
} from '@/actions/testimonials'
import { X } from 'lucide-react'
import type { Testimonial } from '@/types/database'

interface TestimonialFormProps {
  testimonial?: Testimonial
  onClose: () => void
  onSave: (testimonial: Testimonial) => void
}

export function TestimonialForm({
  testimonial,
  onClose,
  onSave,
}: TestimonialFormProps) {
  const isEditing = !!testimonial
  const [name, setName] = useState(testimonial?.name ?? '')
  const [quote, setQuote] = useState(testimonial?.quote ?? '')
  const [role, setRole] = useState(testimonial?.role ?? '')
  const [company, setCompany] = useState(testimonial?.company ?? '')
  const [imageUrl, setImageUrl] = useState(testimonial?.image_url ?? '')
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let result: Testimonial
      if (isEditing) {
        result = await updateTestimonial(testimonial.id, {
          name,
          quote,
          role: role || null,
          company: company || null,
          image_url: imageUrl || null,
        })
      } else {
        result = await createTestimonial({
          name,
          quote,
          role: role || undefined,
          company: company || undefined,
          image_url: imageUrl || undefined,
        })
      }
      onSave(result)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save testimonial'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Testimonial' : 'Add Testimonial'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Jane Smith"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Quote *
            </label>
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              required
              rows={3}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="This product changed my business..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Role
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="CEO"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Company
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Acme Inc."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Image URL
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="https://..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
                  : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
