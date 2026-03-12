"use client";

import { useState, useEffect } from "react";
import { MessageBubble } from "./message-bubble";
import { ToolCallCard } from "./tool-call-card";

const INITIAL_DISPLAY_COUNT = 100;
const LOAD_MORE_COUNT = 50;

type ToolCallData = { name: string; input: unknown; result?: unknown };

type Message = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallData[];
  timestamp: string;
};

export function MessageList({
  messages,
  onToolSelect,
}: {
  messages: Message[];
  onToolSelect?: (tool: ToolCallData) => void;
}) {
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  // Reset display count when conversation changes
  useEffect(() => {
    if (messages.length <= INITIAL_DISPLAY_COUNT) {
      setDisplayCount(INITIAL_DISPLAY_COUNT);
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <p>Start a conversation...</p>
      </div>
    );
  }

  const hasMore = messages.length > displayCount;
  const startIndex = hasMore ? messages.length - displayCount : 0;
  const visibleMessages = messages.slice(startIndex);

  return (
    <div className="space-y-4">
      {hasMore && (
        <button
          onClick={() => setDisplayCount((prev) => prev + LOAD_MORE_COUNT)}
          className="mx-auto block rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Load earlier messages ({messages.length - displayCount} hidden)
        </button>
      )}
      {visibleMessages.map((message, i) => (
        <div key={startIndex + i}>
          <MessageBubble
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
          />
          {message.toolCalls?.map((tc, j) => (
            <ToolCallCard
              key={j}
              name={tc.name}
              input={tc.input}
              result={tc.result}
              onClick={onToolSelect ? () => onToolSelect(tc) : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
