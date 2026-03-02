'use client'

import { useState, useCallback, useRef } from 'react'
import type { AgentMessage, ToolCallResult } from '@/types'

interface UseAgentChatOptions {
  agentId: string
  conversationId?: string
}

interface UseAgentChatReturn {
  messages: AgentMessage[]
  sendMessage: (content: string) => Promise<void>
  isLoading: boolean
  toolCalls: ToolCallResult[]
  error: string | null
  clearMessages: () => void
}

export function useAgentChat({
  agentId,
  conversationId,
}: UseAgentChatOptions): UseAgentChatReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [toolCalls, setToolCalls] = useState<ToolCallResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return

      setError(null)
      setIsLoading(true)

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

      try {
        const response = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            conversationId,
            message: content,
            history: messages,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            errorData.error || `Request failed with status ${response.status}`
          )
        }

        // Handle streaming response
        if (
          response.headers
            .get('content-type')
            ?.includes('text/event-stream')
        ) {
          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let assistantContent = ''

          if (reader) {
            // Add a placeholder assistant message
            const assistantMessage: AgentMessage = {
              role: 'assistant',
              content: '',
              timestamp: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, assistantMessage])

            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const chunk = decoder.decode(value, { stream: true })
              const lines = chunk.split('\n')

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6)
                  if (data === '[DONE]') continue

                  try {
                    const parsed = JSON.parse(data)

                    if (parsed.type === 'text') {
                      assistantContent += parsed.content
                      setMessages((prev) => {
                        const updated = [...prev]
                        const last = updated[updated.length - 1]
                        if (last && last.role === 'assistant') {
                          updated[updated.length - 1] = {
                            ...last,
                            content: assistantContent,
                          }
                        }
                        return updated
                      })
                    } else if (parsed.type === 'tool_call') {
                      setToolCalls((prev) => [
                        ...prev,
                        {
                          name: parsed.name,
                          input: parsed.input,
                          output: parsed.output,
                          status: parsed.status || 'completed',
                        },
                      ])
                    }
                  } catch {
                    // Skip unparseable lines
                  }
                }
              }
            }
          }
        } else {
          // Handle non-streaming (JSON) response
          const data = await response.json()

          const assistantMessage: AgentMessage = {
            role: 'assistant',
            content: data.content || data.message || '',
            timestamp: new Date().toISOString(),
            tool_calls: data.tool_calls,
          }

          setMessages((prev) => [...prev, assistantMessage])

          if (data.tool_calls) {
            setToolCalls((prev) => [
              ...prev,
              ...data.tool_calls.map((tc: ToolCallResult) => ({
                name: tc.name,
                input: tc.input,
                output: tc.output,
                status: tc.status || 'completed',
              })),
            ])
          }
        }
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
      }
    },
    [agentId, conversationId, isLoading, messages]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setToolCalls([])
    setError(null)
  }, [])

  return { messages, sendMessage, isLoading, toolCalls, error, clearMessages }
}
