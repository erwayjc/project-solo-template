"use client";

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
  return (
    <button
      onClick={onClick}
      className="my-2 ml-4 flex w-auto items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors"
    >
      <span className="font-mono text-xs text-gray-600">
        {result ? "\u2713" : "\u25CB"} {name}
      </span>
      {onClick && (
        <span className="ml-auto text-xs text-gray-400">View details &rarr;</span>
      )}
    </button>
  );
}
