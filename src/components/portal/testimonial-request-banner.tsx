'use client'

import { useState, useEffect } from 'react'
import {
  getMyTestimonialRequest,
  submitTestimonial,
  dismissTestimonialRequest,
} from '@/actions/testimonials'
import { MessageSquareHeart } from 'lucide-react'

export function TestimonialRequestBanner() {
  const [hasRequest, setHasRequest] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [quote, setQuote] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMyTestimonialRequest().then((req) => {
      if (req) setHasRequest(true)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await submitTestimonial({ quote, name: name || undefined })
      setSubmitted(true)
      setTimeout(() => setHasRequest(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setLoading(false)
    }
  }

  async function handleDismiss() {
    try {
      await dismissTestimonialRequest()
      setHasRequest(false)
    } catch {
      // silently ignore
    }
  }

  if (!hasRequest) return null

  if (submitted) {
    return (
      <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-center text-sm text-green-800">
        Thank you for sharing your feedback!
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
      {!showForm ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MessageSquareHeart className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-900">
              We&rsquo;d love to hear about your experience! Share a quick
              testimonial?
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setShowForm(true)}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            >
              Share Feedback
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-md px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100"
            >
              Maybe Later
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm font-medium text-amber-900">
            Share your experience
          </p>

          {error && (
            <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />

          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            required
            rows={3}
            placeholder="What's been your favorite part?"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
