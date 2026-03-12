'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChatContainer } from '@/components/agent/chat-container'
import { MessageCircle, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface FloatingAgentWidgetProps {
  agentSlug?: string
}

export function FloatingAgentWidget({
  agentSlug = 'dev-agent',
}: FloatingAgentWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    },
    []
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="hidden md:block">
      {/* Chat Panel */}
      <div
        className={cn(
          'fixed bottom-20 right-6 z-50 w-96 h-[32rem] max-h-[80vh] rounded-lg border bg-white shadow-2xl transition-all duration-200',
          isOpen
            ? 'opacity-100 scale-100'
            : 'pointer-events-none opacity-0 scale-95'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-900">
              Dev Agent
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* Chat body */}
        <div className="h-[calc(100%-48px)]">
          {isOpen && <ChatContainer agentSlug={agentSlug} showSidebar={false} />}
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-105',
          isOpen
            ? 'bg-gray-700 text-white hover:bg-gray-800'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        )}
        title="Toggle Dev Agent (Cmd+J)"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </button>
    </div>
  )
}
