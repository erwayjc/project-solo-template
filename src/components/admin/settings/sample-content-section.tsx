'use client'

import { useState, useTransition } from 'react'
import { clearSampleContent } from '@/actions/onboarding'
import { Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'

export function SampleContentSection() {
  const [isPending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)
  const [result, setResult] = useState<{ deleted: number } | null>(null)

  function handleClear() {
    startTransition(async () => {
      const res = await clearSampleContent()
      setResult({ deleted: res.deleted })
      setShowConfirm(false)
    })
  }

  if (result) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 p-4">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <p className="text-sm text-green-800">
          Cleared {result.deleted} sample content items.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-gray-500">
        Your platform includes sample blog posts, products, email sequences, and more to help you get started. Once you&apos;ve created your own content, you can remove the samples.
      </p>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          Clear All Sample Content
        </button>
      ) : (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">Are you sure?</p>
              <p className="mt-1 text-sm text-amber-700">
                This will permanently delete all sample products, blog posts, email sequences, testimonials, content queue items, and announcements. This cannot be undone.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleClear}
                  disabled={isPending}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? 'Clearing...' : 'Yes, Clear Everything'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isPending}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
