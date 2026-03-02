"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

function maskValue(val: string): string {
  if (val.length <= 4) return val;
  const visible = val.slice(-4);
  const masked = "\u2022".repeat(Math.min(val.length - 4, 20));
  return masked + visible;
}

export function ApiKeyInput({
  value,
  onChange,
  placeholder = "Enter API key...",
  label,
  className,
}: ApiKeyInputProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            type={isRevealed ? "text" : "password"}
            value={isRevealed ? value : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          {/* Masked overlay when not revealed and value exists */}
          {!isRevealed && value && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center px-3 font-mono text-sm text-gray-900"
              aria-hidden="true"
            >
              {maskValue(value)}
            </div>
          )}
        </div>

        {/* Reveal toggle */}
        <button
          type="button"
          onClick={() => setIsRevealed(!isRevealed)}
          title={isRevealed ? "Hide" : "Reveal"}
          className="rounded-md border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        >
          {isRevealed ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          disabled={!value}
          title="Copy to clipboard"
          className="rounded-md border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
        >
          {isCopied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
