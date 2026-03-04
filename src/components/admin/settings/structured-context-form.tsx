'use client'

import { useState, useTransition } from 'react'
import { saveMasterContext } from '@/actions/setup'
import { CheckCircle2, AlertCircle } from 'lucide-react'

const TONE_OPTIONS = [
  'Professional',
  'Friendly',
  'Casual',
  'Authoritative',
  'Playful',
]

const SECTION_HEADERS = [
  '## Business Overview',
  '## Target Customer',
  '## Products & Services',
  '## Communication Tone',
  '## Additional Context',
]

function parseContext(context: string): string[] {
  if (!context.trim()) return ['', '', '', '', '']

  const fields: string[] = ['', '', '', '', '']

  // Check if content has our structured headers
  const hasHeaders = SECTION_HEADERS.some((h) => context.includes(h))

  if (!hasHeaders) {
    // Legacy freeform — put everything in field 5
    fields[4] = context.trim()
    return fields
  }

  // Parse structured format
  const sections = context.split(/^## /m).filter(Boolean)

  for (const section of sections) {
    const firstNewline = section.indexOf('\n')
    const header = firstNewline > -1 ? section.substring(0, firstNewline).trim() : section.trim()
    const body = firstNewline > -1 ? section.substring(firstNewline).trim() : ''

    const headerLower = header.toLowerCase()
    if (headerLower.includes('business overview')) {
      fields[0] = body
    } else if (headerLower.includes('target customer')) {
      fields[1] = body
    } else if (headerLower.includes('products & services') || headerLower.includes('products and services')) {
      fields[2] = body
    } else if (headerLower.includes('communication tone')) {
      fields[3] = body
    } else if (headerLower.includes('additional context')) {
      fields[4] = body
    } else {
      // Unrecognized section — append to field 5
      fields[4] = fields[4] ? `${fields[4]}\n\n## ${section.trim()}` : `## ${section.trim()}`
    }
  }

  return fields
}

function buildContext(fields: string[]): string {
  const parts: string[] = []
  const headers = [
    'Business Overview',
    'Target Customer',
    'Products & Services',
    'Communication Tone',
    'Additional Context',
  ]

  for (let i = 0; i < fields.length; i++) {
    if (fields[i].trim()) {
      parts.push(`## ${headers[i]}\n${fields[i].trim()}`)
    }
  }

  return parts.join('\n\n')
}

interface StructuredContextFormProps {
  initialContext: string
}

export function StructuredContextForm({ initialContext }: StructuredContextFormProps) {
  const parsed = parseContext(initialContext)
  const [fields, setFields] = useState(parsed)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateField(index: number, value: string) {
    const updated = [...fields]
    updated[index] = value
    setFields(updated)
    setSaved(false)
    setError(null)
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const context = buildContext(fields)
        await saveMasterContext(context)
        setSaved(true)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save context')
        setSaved(false)
      }
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          What does your business do?
        </label>
        <p className="mt-0.5 text-xs text-gray-500">2-3 sentences describing your business</p>
        <textarea
          value={fields[0]}
          onChange={(e) => updateField(0, e.target.value)}
          rows={3}
          className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="We help solopreneurs build profitable online businesses..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Who is your ideal customer?
        </label>
        <p className="mt-0.5 text-xs text-gray-500">1-2 sentences about your target audience</p>
        <textarea
          value={fields[1]}
          onChange={(e) => updateField(1, e.target.value)}
          rows={2}
          className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Aspiring entrepreneurs who want to build a one-person business..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          What products or services do you offer?
        </label>
        <p className="mt-0.5 text-xs text-gray-500">List your main offerings</p>
        <textarea
          value={fields[2]}
          onChange={(e) => updateField(2, e.target.value)}
          rows={3}
          className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="- Complete online course&#10;- Monthly membership&#10;- 1:1 coaching sessions"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          What tone should your AI use?
        </label>
        <select
          value={fields[3] || ''}
          onChange={(e) => updateField(3, e.target.value)}
          className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select a tone...</option>
          {TONE_OPTIONS.map((tone) => (
            <option key={tone} value={tone}>{tone}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Anything else your AI should know?
        </label>
        <p className="mt-0.5 text-xs text-gray-500">Optional — brand guidelines, key phrases, things to avoid</p>
        <textarea
          value={fields[4]}
          onChange={(e) => updateField(4, e.target.value)}
          rows={4}
          className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Never use corporate jargon. Always suggest actionable next steps..."
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save Context'}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </span>
        )}
        {error && (
          <span className="flex items-center gap-1 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" /> {error}
          </span>
        )}
      </div>
    </div>
  )
}
