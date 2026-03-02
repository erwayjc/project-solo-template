'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from './use-supabase'
import type { BrandColors } from '@/types'

const DEFAULT_COLORS: BrandColors = {
  primary: '#2563eb',
  secondary: '#1e40af',
  accent: '#f59e0b',
  background: '#ffffff',
  text: '#111827',
}

/**
 * Fetches brand colors from site_config and injects them as CSS custom
 * properties on the document root element. This allows Tailwind utility
 * classes (e.g. `text-brand-primary`) to dynamically reflect the admin's
 * chosen brand colors.
 */
export function useBrandTheme(): {
  colors: BrandColors
  isLoading: boolean
} {
  const supabase = useSupabase()
  const [colors, setColors] = useState<BrandColors>(DEFAULT_COLORS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadBrandColors() {
      try {
        const { data, error } = await supabase
          .from('site_config')
          .select('brand_colors')
          .eq('id', 1)
          .single()

        if (error) {
          console.error('Failed to load brand colors:', error.message)
          return
        }

        const brandColors = data?.brand_colors as BrandColors | null
        if (brandColors) {
          setColors(brandColors)
          applyColorsToRoot(brandColors)
        }
      } catch (err) {
        console.error('Error loading brand theme:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadBrandColors()
  }, [supabase])

  return { colors, isLoading }
}

/**
 * Apply brand colors as CSS custom properties on the document root.
 */
function applyColorsToRoot(colors: BrandColors): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.style.setProperty('--brand-primary', colors.primary)
  root.style.setProperty('--brand-secondary', colors.secondary)
  root.style.setProperty('--brand-accent', colors.accent)
  root.style.setProperty('--brand-background', colors.background)
  root.style.setProperty('--brand-text', colors.text)
}
