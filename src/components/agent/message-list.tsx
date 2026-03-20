"use client";

import { useState } from "react";
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
  const [extraCount, setExtraCount] = useState(0);

  // Effective display count: reset to initial when conversation is small
  const displayCount = messages.length <= INITIAL_DISPLAY_COUNT
    ? INITIAL_DISPLAY_COUNT
    : INITIAL_DISPLAY_COUNT + extraCount;

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
          onClick={() => setExtraCount((prev) => prev + LOAD_MORE_COUNT)}
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
