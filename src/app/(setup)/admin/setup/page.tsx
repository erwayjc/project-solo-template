'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSetupStatus, completeSetup } from '@/actions/setup'
import { WizardStep } from '@/components/forms/wizard-step'
import { StepAccount } from '@/components/admin/setup/step-account'
import { StepDatabase } from '@/components/admin/setup/step-database'
import type { SetupWizardStep as SetupStep } from '@/types'
import { Loader2, CheckCircle2 } from 'lucide-react'

const STEP_META = [
  { id: 'account', title: 'Create Your Account', description: 'Set up your admin credentials' },
  { id: 'database', title: 'Database Connection', description: 'Create tables and load sample data' },
  { id: 'welcome', title: 'You\'re In!', description: 'Your dashboard is ready' },
]

export default function SetupWizardPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [stepStatuses, setStepStatuses] = useState<SetupStep[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [setupAlreadyComplete, setSetupAlreadyComplete] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [completionError, setCompletionError] = useState<string | null>(null)

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    try {
      const result = await getSetupStatus()

      // Task 5b: If setup is already complete, show "already complete" screen
      if (result.isComplete) {
        setSetupAlreadyComplete(true)
        setIsLoading(false)
        return
      }

      setStepStatuses(result.steps)

      // Find first incomplete step (only check account and database)
      const firstIncomplete = result.steps.findIndex((s) => s.status !== 'complete')
      if (firstIncomplete >= 0 && firstIncomplete < 2) {
        setCurrentStep(firstIncomplete)
      } else if (firstIncomplete === -1 || firstIncomplete >= 2) {
        // Account + Database both complete, go to welcome
        setCurrentStep(2)
      }
    } catch {
      // On error (e.g., no tables yet), start at step 0
    } finally {
      setIsLoading(false)
    }
  }

  const handleStepComplete = useCallback(async (stepIndex: number) => {
    setStepStatuses((prev) => {
      const updated = [...prev]
      if (updated[stepIndex]) {
        updated[stepIndex] = { ...updated[stepIndex], status: 'complete' }
      }
      return updated
    })

    // Auto-advance to next step
    if (stepIndex < STEP_META.length - 1) {
      setCurrentStep(stepIndex + 1)
    }
  }, [])

  function isStepComplete(stepId: string): boolean {
    return stepStatuses.find((s) => s.id === stepId)?.status === 'complete'
  }

  async function handleGoToDashboard() {
    setIsCompleting(true)
    setCompletionError(null)
    try {
      await completeSetup()
      router.push('/admin')
    } catch (e) {
      setCompletionError(e instanceof Error ? e.message : 'Failed to complete setup. Please try again.')
      setIsCompleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // Task 5b: Setup already complete guard
  if (setupAlreadyComplete) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h1 className="text-2xl font-bold text-gray-900">Your platform is already set up</h1>
        <p className="text-gray-600">Setup has been completed. Head to your dashboard to get started.</p>
        <a
          href="/admin"
          className="mt-4 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go to Dashboard
        </a>
      </div>
    )
  }

  const meta = STEP_META[currentStep]

  function renderStepContent() {
    switch (currentStep) {
      case 0:
        return (
          <StepAccount
            onComplete={() => handleStepComplete(0)}
            isAlreadyComplete={isStepComplete('account')}
          />
        )
      case 1:
        return (
          <StepDatabase
            onComplete={() => handleStepComplete(1)}
            isAlreadyComplete={isStepComplete('database')}
          />
        )
      case 2:
        return (
          <div className="flex flex-col items-center gap-6 py-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">You&apos;re in! Your dashboard is ready.</h2>
              <p className="mt-2 text-gray-600">
                We&apos;ve set up your platform with sample content so you can explore right away.
                Connect integrations and customize your brand whenever you&apos;re ready.
              </p>
            </div>
            <button
              onClick={handleGoToDashboard}
              disabled={isCompleting}
              className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isCompleting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Setting up...
                </span>
              ) : (
                'Go to Dashboard'
              )}
            </button>
            {completionError && (
              <p className="text-sm text-red-600">{completionError}</p>
            )}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900">Setup Wizard</h1>
        <p className="mt-2 text-gray-600">
          Let&apos;s get your business set up. This only takes a minute.
        </p>
      </div>

      <div className="mt-8">
        <WizardStep
          step={currentStep + 1}
          totalSteps={STEP_META.length}
          title={meta.title}
          description={meta.description}
          onBack={currentStep > 0 && currentStep < 2 ? () => setCurrentStep(currentStep - 1) : undefined}
          onNext={
            currentStep < STEP_META.length - 1 && isStepComplete(STEP_META[currentStep].id)
              ? () => setCurrentStep(currentStep + 1)
              : undefined
          }
        >
          {renderStepContent()}
        </WizardStep>
      </div>
    </div>
  )
}
