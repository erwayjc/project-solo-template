'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { AgentMessage, ToolCallResult } from '@/types'

interface UseAgentChatOptions {
  agentId: string
  /** Resume an existing conversation by ID */
  conversationId?: string
  /** Automatically load the most recent conversation on mount */
  autoResume?: boolean
}

interface UseAgentChatReturn {
  messages: AgentMessage[]
  sendMessage: (content: string) => Promise<void>
  isLoading: boolean
  isLoadingHistory: boolean
  toolCalls: ToolCallResult[]
  error: string | null
  clearMessages: () => void
  conversationId: string | undefined
  setConversationId: (id: string | undefined) => void
  /** Current status text during agent processing */
  thinkingStatus: string
  /** Tool names currently being executed */
  activeTools: string[]
  /** Currently active delegation */
  activeDelegation: { specialist: string; specialistName: string } | null
}

export function useAgentChat({
  agentId,
  conversationId: initialConversationId,
  autoResume = false,
}: UseAgentChatOptions): UseAgentChatReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [toolCalls, setToolCalls] = useState<ToolCallResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId)
  const [thinkingStatus, setThinkingStatus] = useState('')
  const [activeTools, setActiveTools] = useState<string[]>([])
  const [activeDelegation, setActiveDelegation] = useState<{ specialist: string; specialistName: string } | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Auto-resume: load the most recent conversation on mount
  useEffect(() => {
    if (!autoResume || initialConversationId) return

    async function loadLatest() {
      setIsLoadingHistory(true)
      try {
        const res = await fetch(
          `/api/agent/conversations?agentId=${encodeURIComponent(agentId)}`
        )
        const data = await res.json()
        if (data.conversations?.length > 0) {
          const latestId = data.conversations[0].id
          // Load the conversation messages
          const { getUserConversation } = await import('@/actions/agents')
          const conv = await getUserConversation(latestId)
          const msgs = (conv.messages as unknown as AgentMessage[]) ?? []
          setMessages(msgs)
          setConversationId(latestId)
        }
      } catch {
        // No history to load
      } finally {
        setIsLoadingHistory(false)
      }
    }

    loadLatest()
  }, [agentId, autoResume, initialConversationId])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return

      setError(null)
      setIsLoading(true)
      setThinkingStatus('Starting...')
      setActiveTools([])

      // Add user message immediately
      const userMessage: AgentMessage = {
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMessage])

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      // Accumulate data across the stream
      const collectedToolCalls: ToolCallResult[] = []
      let assistantText = ''

      try {
        const response = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            conversationId,
            message: content,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            errorData.error || `Request failed with status ${response.status}`
          )
        }

        // Handle SSE stream
        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response stream')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const event = JSON.parse(data)

              switch (event.type) {
                case 'status':
                  setThinkingStatus(event.message)
                  break

                case 'tool_start':
                  setThinkingStatus('Using tools...')
                  setActiveTools((prev) => [...prev, event.toolName])
                  break

                case 'tool_end':
                  setActiveTools((prev) => prev.filter((t) => t !== event.toolName))
                  break

                case 'delegation_start':
                  setActiveDelegation({
                    specialist: event.specialist,
                    specialistName: event.specialistName,
                  })
                  setThinkingStatus(`Consulting ${event.specialistName}...`)
                  break

                case 'delegation_end':
                  setActiveDelegation(null)
                  break

                case 'text':
                  assistantText = event.content
                  break

                case 'done':
                  if (event.conversationId) {
                    setConversationId(event.conversationId)
                  }
                  // Use full tool call data from done event
                  if (event.toolCalls?.length > 0) {
                    collectedToolCalls.length = 0
                    for (const tc of event.toolCalls) {
                      collectedToolCalls.push({
                        name: tc.name,
                        input: tc.input,
                        output: tc.result,
                        status: 'completed',
                      })
                    }
                  }
                  break
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }

        // Add assistant message
        const assistantMessage: AgentMessage = {
          role: 'assistant',
          content: assistantText || '',
          timestamp: new Date().toISOString(),
          tool_calls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
        }

        setMessages((prev) => [...prev, assistantMessage])
        setToolCalls((prev) => [...prev, ...collectedToolCalls])
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        const message =
          err instanceof Error ? err.message : 'Failed to send message'
        setError(message)

        // Add error message to chat
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${message}`,
            timestamp: new Date().toISOString(),
          },
        ])
      } finally {
        setIsLoading(false)
        setThinkingStatus('')
        setActiveTools([])
        setActiveDelegation(null)
      }
    },
    [agentId, conversationId, isLoading]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setToolCalls([])
    setError(null)
    setConversationId(undefined)
  }, [])

  return {
    messages,
    sendMessage,
    isLoading,
    isLoadingHistory,
    toolCalls,
    error,
    clearMessages,
    conversationId,
    setConversationId,
    thinkingStatus,
    activeTools,
    activeDelegation,
  }
}
