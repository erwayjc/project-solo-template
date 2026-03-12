"use client";

import { useState, useRef, useEffect } from "react";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { MarkdownContent } from "@/components/agent/markdown-content";
import { cn } from "@/lib/utils/cn";

interface SupportChatProps {
  agentSlug?: string;
  className?: string;
}

export function SupportChat({
  agentSlug = "support-agent",
  className,
}: SupportChatProps) {
  const { messages, sendMessage, isLoading, isLoadingHistory, error } = useAgentChat({
    agentId: agentSlug,
    autoResume: true,
  });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input;
    setInput("");
    await sendMessage(message);
  }

  return (
    <div
      className={cn(
        "flex h-96 flex-col rounded-lg border bg-white shadow-sm",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        <h3 className="text-sm font-semibold text-gray-900">Support</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoadingHistory && (
          <p className="text-center text-sm text-gray-400 animate-pulse">
            Loading conversation...
          </p>
        )}
        {!isLoadingHistory && messages.length === 0 && (
          <p className="text-center text-sm text-gray-400">
            Send a message to start a conversation.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "mb-3 max-w-[80%] rounded-lg px-3 py-2 text-sm",
              msg.role === "user"
                ? "ml-auto bg-blue-600 text-white"
                : "mr-auto bg-gray-100 text-gray-900",
            )}
          >
            {msg.role === "assistant" ? (
              <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-a:text-blue-600">
                <MarkdownContent content={msg.content} />
              </div>
            ) : (
              msg.content
            )}
          </div>
        ))}
        {isLoading && (
          <div className="mr-auto mb-3 max-w-[80%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-500">
            <span className="animate-pulse">Typing...</span>
          </div>
        )}
        {error && (
          <p className="mb-3 text-center text-xs text-red-500">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex border-t px-3 py-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading || isLoadingHistory}
          className="flex-1 bg-transparent px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
