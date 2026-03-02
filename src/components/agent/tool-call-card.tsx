"use client";

import { useState } from "react";

export function ToolCallCard({
  name,
  input,
  result,
}: {
  name: string;
  input: unknown;
  result?: unknown;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-2 ml-4 rounded-md border border-gray-200 bg-gray-50 text-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="font-mono text-xs text-gray-600">
          {result ? "\u2713" : "\u25CB"} {name}
        </span>
        <span className="text-xs text-gray-400">
          {expanded ? "\u25B2" : "\u25BC"}
        </span>
      </button>
      {expanded && (
        <div className="border-t px-3 py-2">
          <p className="text-xs font-medium text-gray-500">Input:</p>
          <pre className="mt-1 overflow-x-auto text-xs text-gray-600">
            {JSON.stringify(input, null, 2)}
          </pre>
          {!!result && (
            <>
              <p className="mt-2 text-xs font-medium text-gray-500">Result:</p>
              <pre className="mt-1 overflow-x-auto text-xs text-gray-600">
                {JSON.stringify(result, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
