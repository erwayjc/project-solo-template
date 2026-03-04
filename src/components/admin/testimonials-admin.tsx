'use client'

import { useState } from 'react'
import {
  deleteTestimonial,
  updateTestimonial,
} from '@/actions/testimonials'
import { TestimonialForm } from '@/components/admin/testimonial-form'
import { cn } from '@/lib/utils/cn'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { Testimonial } from '@/types/database'

interface TestimonialsAdminProps {
  initialTestimonials: Testimonial[]
}

export function TestimonialsAdmin({
  initialTestimonials,
}: TestimonialsAdminProps) {
  const [testimonials, setTestimonials] = useState(initialTestimonials)
  const [showForm, setShowForm] = useState(false)
  const [editingTestimonial, setEditingTestimonial] =
    useState<Testimonial | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  async function handleTogglePublished(testimonial: Testimonial) {
    setLoading(testimonial.id)
    try {
      const updated = await updateTestimonial(testimonial.id, {
        is_published: !testimonial.is_published,
      })
      setTestimonials((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      )
    } catch (err) {
      console.error('Failed to toggle published:', err)
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this testimonial?')) return
    setLoading(id)
    try {
      await deleteTestimonial(id)
      setTestimonials((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      console.error('Failed to delete testimonial:', err)
    } finally {
      setLoading(null)
    }
  }

  function handleSaved(testimonial: Testimonial) {
    setTestimonials((prev) => {
      const exists = prev.find((t) => t.id === testimonial.id)
      if (exists) {
        return prev.map((t) => (t.id === testimonial.id ? testimonial : t))
      }
      return [...prev, testimonial]
    })
    setShowForm(false)
    setEditingTestimonial(null)
  }

  return (
    <>
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditingTestimonial(null)
            setShowForm(true)
          }}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Testimonial
        </button>
      </div>

      {/* Grid */}
      {testimonials.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <p className="text-sm text-gray-500">No testimonials yet.</p>
          <p className="mt-1 text-xs text-gray-400">
            Add your first testimonial to display on public pages.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="rounded-lg border bg-white p-5 shadow-sm"
            >
              <blockquote className="line-clamp-3 text-sm text-gray-700">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <div className="mt-3">
                <p className="font-semibold text-gray-900">
                  {testimonial.name}
                </p>
                {(testimonial.role || testimonial.company) && (
                  <p className="text-xs text-gray-500">
                    {[testimonial.role, testimonial.company]
                      .filter(Boolean)
                      .join(' at ')}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => handleTogglePublished(testimonial)}
                  disabled={loading === testimonial.id}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                    testimonial.is_published
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {testimonial.is_published ? 'Published' : 'Draft'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingTestimonial(testimonial)
                      setShowForm(true)
                    }}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(testimonial.id)}
                    disabled={loading === testimonial.id}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <TestimonialForm
          testimonial={editingTestimonial ?? undefined}
          onClose={() => {
            setShowForm(false)
            setEditingTestimonial(null)
          }}
          onSave={handleSaved}
        />
      )}
    </>
  )
}
