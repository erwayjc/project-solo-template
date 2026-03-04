'use client'

import { useCallback } from 'react'
import { updateOnboardingChecklist } from '@/actions/onboarding'

type CelebrationType = 'first_post' | 'first_checklist'

const FLAG_MAP: Record<CelebrationType, 'first_post_celebrated' | 'first_checklist_celebrated'> = {
  first_post: 'first_post_celebrated',
  first_checklist: 'first_checklist_celebrated',
}

export function useCelebration() {
  const celebrate = useCallback(async (type: CelebrationType, alreadyCelebrated: boolean) => {
    if (alreadyCelebrated) return

    try {
      const confetti = (await import('canvas-confetti')).default
      confetti({
        particleCount: 50,
        spread: 60,
        decay: 0.9,
        ticks: 200,
        origin: { y: 0.6 },
      })

      // Only mark as celebrated after confetti fires successfully
      const flagKey = FLAG_MAP[type]
      await updateOnboardingChecklist({ [flagKey]: true })
    } catch (err) {
      // Celebrations are non-critical — log but don't throw
      console.error('Celebration failed:', err)
    }
  }, [])

  return { celebrate }
}
