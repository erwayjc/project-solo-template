'use client'

import { useState, useTransition } from 'react'
import { updateOnboardingChecklist } from '@/actions/onboarding'
import { CheckCircle2, RotateCcw } from 'lucide-react'

interface GuideToggleSectionProps {
  guideDismissed: boolean
}

export function GuideToggleSection({ guideDismissed }: GuideToggleSectionProps) {
  const [dismissed, setDismissed] = useState(guideDismissed)
  const [isPending, startTransition] = useTransition()

  function handleReEnable() {
    startTransition(async () => {
      await updateOnboardingChecklist({ guide_dismissed: false })
      setDismissed(false)
    })
  }

  if (!dismissed) {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
        <p className="text-sm text-gray-600">
          The Getting Started guide is currently visible on your dashboard.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-gray-500">
        The Getting Started guide has been dismissed. Re-enable it to see your setup progress on the dashboard.
      </p>
      <button
        onClick={handleReEnable}
        disabled={isPending}
        className="mt-3 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        <RotateCcw className="h-4 w-4" />
        {isPending ? 'Enabling...' : 'Re-enable Getting Started Guide'}
      </button>
    </div>
  )
}
