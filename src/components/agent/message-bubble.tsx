"use client";

import { MarkdownContent } from "./markdown-content";

function relativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function MessageBubble({
  role,
  content,
  timestamp,
}: {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={isUser ? "max-w-[80%]" : "max-w-[90%]"}>
        {/* Role label + timestamp */}
        <div
          className={`mb-1 flex items-center gap-2 text-xs ${
            isUser ? "justify-end" : "justify-start"
          }`}
        >
          <span className="font-medium text-gray-400">
            {isUser ? "You" : "Assistant"}
          </span>
          <time className="text-gray-300">{relativeTime(timestamp)}</time>
        </div>

        {/* Message content */}
        <div
          className={
            isUser
              ? "rounded-2xl rounded-br-md bg-blue-50 px-4 py-3 text-blue-900"
              : "rounded-2xl rounded-bl-md border-l-2 border-gray-200 bg-white px-4 py-3 text-gray-900"
          }
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm">{content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-pre:my-2 prose-li:my-0.5 prose-a:text-blue-600">
              <MarkdownContent content={content} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
