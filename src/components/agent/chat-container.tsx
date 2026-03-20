"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ConversationSidebar } from "./conversation-sidebar";
import { ThinkingIndicator } from "./thinking-indicator";
import { ToolDetailPanel } from "./tool-detail-panel";
import { getUserConversations, getUserConversation } from "@/actions/agents";

type ToolCallData = { name: string; input: unknown; result?: unknown };

type Message = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallData[];
  timestamp: string;
};

type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export function ChatContainer({
  agentSlug,
  agentId,
  showSidebar = true,
}: {
  agentSlug?: string;
  agentId?: string;
  showSidebar?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [resolvedAgentId, setResolvedAgentId] = useState<string | undefined>(agentId);
  const [thinkingStatus, setThinkingStatus] = useState("");
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [selectedTool, setSelectedTool] = useState<{
    name: string;
    input: unknown;
    result?: unknown;
  } | null>(null);
  const [activeDelegation, setActiveDelegation] = useState<{
    specialist: string;
    specialistName: string;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingStatus, activeTools]);

  // Resolve agentId from slug if needed, then load conversations
  useEffect(() => {
    async function init() {
      let effectiveAgentId = agentId;

      // If we only have a slug, resolve the agent ID
      if (!effectiveAgentId && agentSlug) {
        try {
          const res = await fetch(
            `/api/agent/conversations?agentSlug=${encodeURIComponent(agentSlug)}`
          );
          const data = await res.json();
          if (data.agentId) {
            effectiveAgentId = data.agentId;
            setResolvedAgentId(effectiveAgentId);
          }
          // Also use the returned conversations directly
          if (data.conversations) {
            setConversations(
              data.conversations.map((c: { id: string; title: string; updated_at: string }) => ({
                id: c.id,
                title: c.title,
                updatedAt: c.updated_at,
              }))
            );
            // Auto-load the most recent conversation
            if (data.conversations.length > 0) {
              loadConversation(data.conversations[0].id);
            }
            return;
          }
        } catch {
          // Fall through to try direct load
        }
      }

      if (!effectiveAgentId) return;

      try {
        const convos = await getUserConversations(effectiveAgentId);
        setConversations(
          convos.map((c) => ({
            id: c.id,
            title: c.title,
            updatedAt: c.updated_at,
          }))
        );
        // Auto-load the most recent conversation
        if (convos.length > 0) {
          loadConversation(convos[0].id);
        }
      } catch {
        // Conversations may not be available (e.g., first time)
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, agentSlug]);

  const loadConversation = useCallback(async (id: string) => {
    setIsLoadingHistory(true);
    try {
      const conv = await getUserConversation(id);
      const msgs = (conv.messages as unknown as Message[]) ?? [];
      setMessages(msgs);
      setConversationId(id);
      setSelectedTool(null);
    } catch {
      // If loading fails, start fresh
      setMessages([]);
      setConversationId(undefined);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  function handleSelectConversation(id: string) {
    if (id === conversationId) return;
    loadConversation(id);
  }

  function handleNewConversation() {
    setMessages([]);
    setConversationId(undefined);
    setSelectedTool(null);
  }

  async function refreshConversationList() {
    const id = resolvedAgentId || agentId;
    if (!id) return;
    try {
      const convos = await getUserConversations(id);
      setConversations(
        convos.map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updated_at,
        }))
      );
    } catch {
      // Silently fail
    }
  }

  async function sendMessage(content: string) {
    const userMessage: Message = {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setThinkingStatus("Starting...");
    setActiveTools([]);

    // Accumulate tool calls and text across the stream
    const collectedToolCalls: ToolCallData[] = [];
    let assistantText = "";
    let newConversationId: string | undefined;

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          agentSlug,
          agentId,
          conversationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines from the buffer
        const lines = buffer.split("\n");
        // Keep the last (possibly incomplete) line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case "status":
                setThinkingStatus(event.message);
                break;

              case "tool_start":
                setThinkingStatus(`Using tools...`);
                setActiveTools((prev) => [...prev, event.toolName]);
                break;

              case "tool_end":
                setActiveTools((prev) => prev.filter((t) => t !== event.toolName));
                collectedToolCalls.push({
                  name: event.toolName,
                  input: {},
                });
                break;

              case "delegation_start":
                setActiveDelegation({
                  specialist: event.specialist,
                  specialistName: event.specialistName,
                });
                setThinkingStatus(`Consulting ${event.specialistName}...`);
                break;

              case "delegation_end":
                setActiveDelegation(null);
                break;

              case "text":
                assistantText = event.content;
                break;

              case "done":
                newConversationId = event.conversationId;
                // Replace minimal tool call data with full data from done event
                if (event.toolCalls?.length > 0) {
                  collectedToolCalls.length = 0;
                  for (const tc of event.toolCalls) {
                    collectedToolCalls.push({
                      name: tc.name,
                      input: tc.input,
                      result: tc.result,
                    });
                  }
                }
                // Update sidebar with auto-generated title
                if (event.title && event.conversationId) {
                  setConversations((prev) =>
                    prev.map((c) =>
                      c.id === event.conversationId
                        ? { ...c, title: event.title }
                        : c
                    )
                  );
                }
                break;
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }

      // Update conversation ID
      if (newConversationId) {
        setConversationId(newConversationId);
        if (!conversationId) {
          setTimeout(() => refreshConversationList(), 500);
        }
      }

      // Add the assistant message with collected data
      const assistantMessage: Message = {
        role: "assistant",
        content: assistantText || "Sorry, I couldn't process that request.",
        toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "An error occurred. Please try again.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setThinkingStatus("");
      setActiveTools([]);
      setActiveDelegation(null);
    }
  }

  const chatPanel = (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        {isLoadingHistory ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            <span className="animate-pulse">Loading conversation...</span>
          </div>
        ) : (
          <MessageList messages={messages} onToolSelect={setSelectedTool} />
        )}
        {isLoading && thinkingStatus && (
          <ThinkingIndicator status={thinkingStatus} activeTools={activeTools} activeDelegation={activeDelegation} />
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={sendMessage} disabled={isLoading || isLoadingHistory} />
      <ToolDetailPanel
        tool={selectedTool}
        onClose={() => setSelectedTool(null)}
      />
    </div>
  );

  if (!showSidebar) {
    return (
      <div className="flex h-full flex-col rounded-lg border bg-white">
        {chatPanel}
      </div>
    );
  }

  return (
    <div className="flex h-full rounded-lg border bg-white overflow-hidden">
      <ConversationSidebar
        conversations={conversations}
        selected={conversationId}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {chatPanel}
      </div>
    </div>
  );
}
