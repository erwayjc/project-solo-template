"use client";

import { useState } from "react";

export function ToolCallCard({
  name,
  result,
  onClick,
}: {
  name: string;
  input: unknown;
  result?: unknown;
  onClick?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasResult = result !== undefined && result !== null;

  function formatToolName(toolName: string) {
    return toolName
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase());
  }

  function getResultPreview(): string {
    if (!hasResult) return "";
    const str = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    const lines = str.split("\n");
    if (lines.length <= 3) return str;
    return lines.slice(0, 3).join("\n") + "\n...";
  }

  return (
    <div className="my-1.5 ml-4">
      <button
        onClick={() => {
          if (hasResult) setIsExpanded((prev) => !prev);
        }}
        className="flex w-auto items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-1.5 text-left text-sm transition-all hover:border-gray-300 hover:bg-gray-50"
      >
        {/* Status indicator */}
        {hasResult ? (
          <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg
            className="h-3.5 w-3.5 animate-spin text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}

        <span className="text-xs font-medium text-gray-600">
          {formatToolName(name)}
        </span>

        {/* Expand/collapse chevron */}
        {hasResult && (
          <svg
            className={`ml-1 h-3 w-3 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Expanded result preview */}
      {isExpanded && hasResult && (
        <div className="ml-1 mt-1 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <pre className="max-h-32 overflow-auto text-xs text-gray-600">
            {getResultPreview()}
          </pre>
          {onClick && (
            <button
              onClick={onClick}
              className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              View full details &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
