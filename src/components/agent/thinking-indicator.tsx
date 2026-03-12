"use client";

import { Users } from "lucide-react";

/**
 * Displays real-time feedback on what the agent is doing:
 * current status message, active tool calls, and delegation activity.
 */
export function ThinkingIndicator({
  status,
  activeTools,
  activeDelegation,
}: {
  status: string;
  activeTools: string[];
  activeDelegation?: { specialist: string; specialistName: string } | null;
}) {
  // Format tool name for display: "get_products" → "Get products"
  function formatToolName(name: string) {
    return name
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase());
  }

  return (
    <div className="flex flex-col gap-1.5 px-4 py-2 text-sm text-gray-500">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
        </span>
        <span>{status}</span>
      </div>
      {activeDelegation && (
        <div className="flex items-center gap-2 pl-4 text-xs text-purple-500">
          <Users className="h-3 w-3" />
          <span>Consulting {activeDelegation.specialistName}...</span>
        </div>
      )}
      {activeTools.map((tool) => (
        <div key={tool} className="flex items-center gap-2 pl-4 text-xs text-gray-400">
          <svg
            className="h-3 w-3 animate-spin text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Running {formatToolName(tool)}</span>
        </div>
      ))}
    </div>
  );
}
