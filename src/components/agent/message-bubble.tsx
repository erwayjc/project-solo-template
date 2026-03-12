"use client";

import { MarkdownContent } from "./markdown-content";

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
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-pre:my-2 prose-li:my-0.5 prose-a:text-blue-600">
            <MarkdownContent content={content} />
          </div>
        )}
        <time
          className={`mt-1 block text-xs ${
            isUser ? "text-blue-200" : "text-gray-400"
          }`}
        >
          {new Date(timestamp).toLocaleTimeString()}
        </time>
      </div>
    </div>
  );
}
