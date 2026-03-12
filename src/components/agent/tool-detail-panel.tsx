"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

interface ToolDetailPanelProps {
  tool: { name: string; input: unknown; result?: unknown } | null;
  onClose: () => void;
}

export function ToolDetailPanel({ tool, onClose }: ToolDetailPanelProps) {
  return (
    <div
      className={cn(
        "absolute inset-y-0 right-0 z-40 w-96 max-w-full border-l bg-white shadow-xl transition-transform duration-200",
        tool ? "translate-x-0" : "translate-x-full pointer-events-none"
      )}
    >
      {tool && (
        <>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="truncate font-mono text-sm font-semibold text-gray-900">
              {tool.name}
            </h3>
            <button
              onClick={onClose}
              className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="h-[calc(100%-49px)] overflow-y-auto p-4">
            <section className="mb-4">
              <h4 className="mb-2 text-xs font-medium text-gray-500">Input</h4>
              <pre className="overflow-x-auto rounded-md bg-gray-50 p-3 text-xs leading-relaxed">
                {renderColorizedJson(tool.input)}
              </pre>
            </section>
            {tool.result !== undefined && (
              <section>
                <h4 className="mb-2 text-xs font-medium text-gray-500">
                  Output
                </h4>
                <pre className="overflow-x-auto rounded-md bg-gray-50 p-3 text-xs leading-relaxed">
                  {renderColorizedJson(tool.result)}
                </pre>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSS-only JSON colorization
// ---------------------------------------------------------------------------

function renderColorizedJson(value: unknown, indent = 0): ReactNode {
  if (value === null) {
    return <span className="text-amber-600">null</span>;
  }

  if (typeof value === "boolean") {
    return <span className="text-amber-600">{String(value)}</span>;
  }

  if (typeof value === "number") {
    return <span className="text-blue-600">{String(value)}</span>;
  }

  if (typeof value === "string") {
    return <span className="text-green-700">&quot;{value}&quot;</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <>{"[]"}</>;
    const pad = "  ".repeat(indent);
    const innerPad = "  ".repeat(indent + 1);
    return (
      <>
        {"[\n"}
        {value.map((item, i) => (
          <span key={i}>
            {innerPad}
            {renderColorizedJson(item, indent + 1)}
            {i < value.length - 1 ? ",\n" : "\n"}
          </span>
        ))}
        {pad}
        {"]"}
      </>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <>{"{}"}  </>;
    const pad = "  ".repeat(indent);
    const innerPad = "  ".repeat(indent + 1);
    return (
      <>
        {"{\n"}
        {entries.map(([key, val], i) => (
          <span key={key}>
            {innerPad}
            <span className="text-gray-500">&quot;{key}&quot;</span>
            {": "}
            {renderColorizedJson(val, indent + 1)}
            {i < entries.length - 1 ? ",\n" : "\n"}
          </span>
        ))}
        {pad}
        {"}"}
      </>
    );
  }

  return <>{String(value)}</>;
}
