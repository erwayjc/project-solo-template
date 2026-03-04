'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Circle,
  Rocket,
  CreditCard,
  Mail,
  Bot,
  Share2,
  Palette,
  Brain,
  X,
  FileText,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { updateOnboardingChecklist } from '@/actions/onboarding'
import { useCelebration } from '@/hooks/use-celebration'
import type { OnboardingProgress } from '@/types'

interface GettingStartedGuideProps {
  progress: OnboardingProgress
}

interface ChecklistItemProps {
  completed: boolean
  label: string
  href?: string
  icon: React.ReactNode
}

function ChecklistItem({ completed, label, href, icon }: ChecklistItemProps) {
  const content = (
    <div className={cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
      completed ? 'text-gray-400' : 'text-gray-700 hover:bg-gray-50'
    )}>
      {completed ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-gray-300" />
      )}
      {icon}
      <span className={completed ? 'line-through' : ''}>{label}</span>
    </div>
  )

  if (href && !completed) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

export function GettingStartedGuide({ progress }: GettingStartedGuideProps) {
  const [dismissed, setDismissed] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { celebrate } = useCelebration()
  const prevCompletedRef = useRef<number | null>(null)

  // Count completed items
  const allItems = [
    progress.quickWins.explored_admin,
    progress.quickWins.created_first_post,
    progress.quickWins.edited_homepage,
    progress.powerUps.payments_connected,
    progress.powerUps.email_connected,
    progress.powerUps.ai_connected,
    progress.powerUps.social_connected,
    progress.personalization.brand_customized,
    progress.personalization.context_configured,
  ]
  const completedCount = allItems.filter(Boolean).length
  const totalCount = allItems.length

  // Celebrate on first checklist item completion
  useEffect(() => {
    if (prevCompletedRef.current !== null && completedCount > prevCompletedRef.current) {
      celebrate('first_checklist', progress.celebration_flags.first_checklist_celebrated)
    }
    prevCompletedRef.current = completedCount
  }, [completedCount, celebrate, progress.celebration_flags.first_checklist_celebrated])

  if (dismissed) return null

  function handleDismiss() {
    startTransition(async () => {
      await updateOnboardingChecklist({ guide_dismissed: true })
      setDismissed(true)
    })
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Rocket className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Welcome to Your Business</h2>
            <p className="text-sm text-gray-500">
              {completedCount} of {totalCount} complete
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          disabled={isPending}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Dismiss guide"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-500"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {/* Quick Wins */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Quick Wins</h3>
          <div className="space-y-1">
            <ChecklistItem
              completed={progress.quickWins.explored_admin}
              label="Explore admin panel"
              href="/admin/content"
              icon={<Rocket className="h-4 w-4 shrink-0 text-gray-400" />}
            />
            <ChecklistItem
              completed={progress.quickWins.created_first_post}
              label="Create first blog post"
              href="/admin/content?new=true"
              icon={<FileText className="h-4 w-4 shrink-0 text-gray-400" />}
            />
            <ChecklistItem
              completed={progress.quickWins.edited_homepage}
              label="Edit homepage"
              href="/admin/content/pages"
              icon={<Globe className="h-4 w-4 shrink-0 text-gray-400" />}
            />
          </div>
        </div>

        {/* Power Ups */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Power Ups</h3>
          <div className="space-y-1">
            <ChecklistItem
              completed={progress.powerUps.payments_connected}
              label="Connect payments"
              href="/admin/settings#integrations"
              icon={<CreditCard className="h-4 w-4 shrink-0 text-gray-400" />}
            />
            <ChecklistItem
              completed={progress.powerUps.email_connected}
              label="Connect email"
              href="/admin/settings#integrations"
              icon={<Mail className="h-4 w-4 shrink-0 text-gray-400" />}
            />
            <ChecklistItem
              completed={progress.powerUps.ai_connected}
              label="Connect AI agents"
              href="/admin/settings#integrations"
              icon={<Bot className="h-4 w-4 shrink-0 text-gray-400" />}
            />
            <ChecklistItem
              completed={progress.powerUps.social_connected}
              label="Connect social"
              href="/admin/settings#integrations"
              icon={<Share2 className="h-4 w-4 shrink-0 text-gray-400" />}
            />
          </div>
        </div>

        {/* Make It Yours */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Make It Yours</h3>
          <div className="space-y-1">
            <ChecklistItem
              completed={progress.personalization.brand_customized}
              label="Customize brand"
              href="/admin/settings#branding"
              icon={<Palette className="h-4 w-4 shrink-0 text-gray-400" />}
            />
            <ChecklistItem
              completed={progress.personalization.context_configured}
              label="Train your AI"
              href="/admin/settings#context"
              icon={<Brain className="h-4 w-4 shrink-0 text-gray-400" />}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 border-t pt-4">
        <button
          onClick={handleDismiss}
          disabled={isPending}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {isPending ? 'Dismissing...' : "I'm all set — hide this"}
        </button>
      </div>
    </div>
  )
}
