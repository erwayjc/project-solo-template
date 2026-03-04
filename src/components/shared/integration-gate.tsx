'use client'

import Link from 'next/link'
import { CreditCard, Mail, Bot, Share2, ExternalLink } from 'lucide-react'

const INTEGRATION_CONFIG = {
  stripe: {
    name: 'Stripe',
    icon: CreditCard,
    helpUrl: 'https://dashboard.stripe.com/register',
  },
  resend: {
    name: 'Resend',
    icon: Mail,
    helpUrl: 'https://resend.com/signup',
  },
  anthropic: {
    name: 'Anthropic',
    icon: Bot,
    helpUrl: 'https://console.anthropic.com/',
  },
  buffer: {
    name: 'Buffer',
    icon: Share2,
    helpUrl: 'https://buffer.com/signup',
  },
} as const

interface IntegrationGateProps {
  integration: 'stripe' | 'resend' | 'anthropic' | 'buffer'
  isConnected: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function IntegrationGate({
  integration,
  isConnected,
  children,
  fallback,
}: IntegrationGateProps) {
  if (isConnected) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  const config = INTEGRATION_CONFIG[integration]
  const Icon = config.icon

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <Icon className="mx-auto h-10 w-10 text-gray-400" />
      <h3 className="mt-3 text-sm font-semibold text-gray-900">
        Connect {config.name} to unlock this feature
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        This feature requires {config.name} to be configured.
      </p>
      <div className="mt-4 flex items-center justify-center gap-3">
        <Link
          href="/admin/settings#integrations"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Set Up
        </Link>
        <a
          href={config.helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          Create account
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}
