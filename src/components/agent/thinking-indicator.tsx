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
    <div className="mx-4 my-2 rounded-xl bg-gray-50 px-4 py-3">
      {/* Main status with bouncing dots */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-0.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:300ms]" />
        </div>
        <span className="text-sm font-medium text-gray-600">{status}</span>
      </div>

      {/* Delegation indicator */}
      {activeDelegation && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-600">
          <Users className="h-3 w-3" />
          <span>Consulting {activeDelegation.specialistName}...</span>
        </div>
      )}

      {/* Active tools */}
      {activeTools.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {activeTools.map((tool) => (
            <div
              key={tool}
              className="flex items-center gap-2 text-xs text-gray-500"
            >
              <svg
                className="h-3 w-3 animate-spin text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span>{formatToolName(tool)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
