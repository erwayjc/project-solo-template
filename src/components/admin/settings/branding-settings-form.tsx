'use client'

import { useState, useTransition } from 'react'
import { saveBrandingConfig } from '@/actions/setup'
import type { BrandColors } from '@/types'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface BrandingSettingsFormProps {
  initialConfig: {
    site_name: string
    tagline: string
    logo_url: string | null
    brand_colors: BrandColors
    legal_business_name: string | null
    legal_contact_email: string | null
  }
}

export function BrandingSettingsForm({ initialConfig }: BrandingSettingsFormProps) {
  const [siteName, setSiteName] = useState(initialConfig.site_name)
  const [tagline, setTagline] = useState(initialConfig.tagline)
  const [logoUrl, setLogoUrl] = useState(initialConfig.logo_url || '')
  const [brandColors, setBrandColors] = useState<BrandColors>(initialConfig.brand_colors)
  const [legalName, setLegalName] = useState(initialConfig.legal_business_name || '')
  const [legalEmail, setLegalEmail] = useState(initialConfig.legal_contact_email || '')
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateColor(key: keyof BrandColors, value: string) {
    setBrandColors((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
    setError(null)
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveBrandingConfig({
          site_name: siteName,
          tagline,
          logo_url: logoUrl || undefined,
          brand_colors: brandColors,
          legal_business_name: legalName || undefined,
          legal_contact_email: legalEmail || undefined,
        })
        setSaved(true)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save branding')
        setSaved(false)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Site Name</label>
        <input
          type="text"
          value={siteName}
          onChange={(e) => { setSiteName(e.target.value); setSaved(false) }}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Tagline</label>
        <input
          type="text"
          value={tagline}
          onChange={(e) => { setTagline(e.target.value); setSaved(false) }}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Logo URL</label>
        <input
          type="text"
          value={logoUrl}
          onChange={(e) => { setLogoUrl(e.target.value); setSaved(false) }}
          placeholder="https://..."
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Brand Colors</label>
        <div className="mt-2 grid grid-cols-5 gap-3">
          {(Object.keys(brandColors) as (keyof BrandColors)[]).map((key) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 capitalize">{key}</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={brandColors[key]}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border"
                />
                <input
                  type="text"
                  value={brandColors[key]}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 font-mono text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Legal Business Name</label>
          <input
            type="text"
            value={legalName}
            onChange={(e) => { setLegalName(e.target.value); setSaved(false) }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Legal Contact Email</label>
          <input
            type="email"
            value={legalEmail}
            onChange={(e) => { setLegalEmail(e.target.value); setSaved(false) }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save Changes'}
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
