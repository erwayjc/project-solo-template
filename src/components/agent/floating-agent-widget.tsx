'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChatContainer } from '@/components/agent/chat-container'
import { MessageCircle, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Kbd } from '@/components/ui/kbd'

interface FloatingAgentWidgetProps {
  agentSlug?: string
}

export function FloatingAgentWidget({
  agentSlug = 'dev-agent',
}: FloatingAgentWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

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
          'fixed bottom-20 right-6 z-50 w-96 rounded-xl border border-gray-200 bg-white shadow-2xl transition-all duration-300',
          isOpen
            ? 'h-[32rem] max-h-[80vh] translate-y-0 opacity-100'
            : 'pointer-events-none h-0 translate-y-4 opacity-0'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
              <MessageCircle className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <span className="text-sm font-semibold text-gray-900">
              Dev Agent
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
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
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl',
            isOpen
              ? 'bg-gray-800 text-white hover:bg-gray-900'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
          title="Toggle Dev Agent (Cmd+J)"
        >
          {isOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <MessageCircle className="h-5 w-5" />
          )}
        </button>

        {/* Keyboard shortcut tooltip */}
        <div
          className={cn(
            'absolute bottom-full right-0 mb-2 flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg transition-all duration-200',
            isHovered && !isOpen
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-1 opacity-0'
          )}
        >
          <span>Dev Agent</span>
          <Kbd className="border-gray-600 bg-gray-800 text-gray-300">⌘J</Kbd>
        </div>
      </div>
    </div>
  )
}
