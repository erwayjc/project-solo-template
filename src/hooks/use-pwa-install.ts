'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

interface UsePwaInstallReturn {
  isInstallable: boolean
  isInstalled: boolean
  promptInstall: () => Promise<boolean>
}

/**
 * PWA install prompt hook.
 * Listens for the `beforeinstallprompt` event, tracks whether the app
 * is already installed, and provides a `promptInstall()` function.
 */
export function usePwaInstall(): UsePwaInstallReturn {
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Check if the app is already installed (standalone mode)
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(display-mode: standalone)').matches
    ) {
      setIsInstalled(true)
      return
    }

    // Also check navigator.standalone for iOS
    if (
      typeof window !== 'undefined' &&
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true
    ) {
      setIsInstalled(true)
      return
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent
      setIsInstallable(true)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      deferredPromptRef.current = null
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      )
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPromptRef.current) {
      return false
    }

    try {
      await deferredPromptRef.current.prompt()
      const { outcome } = await deferredPromptRef.current.userChoice

      // Clear the deferred prompt regardless of outcome
      deferredPromptRef.current = null
      setIsInstallable(false)

      return outcome === 'accepted'
    } catch {
      return false
    }
  }, [])

  return { isInstallable, isInstalled, promptInstall }
}
