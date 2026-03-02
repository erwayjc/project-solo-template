"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const DEFAULT_PRESETS = [
  "#2563eb", // blue
  "#16a34a", // green
  "#9333ea", // purple
  "#dc2626", // red
  "#ea580c", // orange
  "#db2777", // pink
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
  label?: string;
  className?: string;
}

export function ColorPicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  label,
  className,
}: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value);

  function handleHexChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setHexInput(raw);

    const normalized = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      onChange(normalized);
    }
  }

  function handleHexBlur() {
    const normalized = hexInput.startsWith("#") ? hexInput : `#${hexInput}`;
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      setHexInput(normalized);
      onChange(normalized);
    } else {
      setHexInput(value);
    }
  }

  function handlePresetClick(color: string) {
    setHexInput(color);
    onChange(color);
  }

  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <p className="text-sm font-medium text-gray-700">{label}</p>
      )}

      {/* Preset swatches */}
      <div className="flex flex-wrap gap-2">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => handlePresetClick(color)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-110",
              value.toLowerCase() === color.toLowerCase()
                ? "border-gray-900"
                : "border-transparent",
            )}
            style={{ backgroundColor: color }}
            title={color}
          >
            {value.toLowerCase() === color.toLowerCase() && (
              <Check className="h-4 w-4 text-white drop-shadow" />
            )}
          </button>
        ))}
      </div>

      {/* Custom hex input */}
      <div className="flex items-center gap-2">
        <div
          className="h-8 w-8 shrink-0 rounded-md border"
          style={{ backgroundColor: value }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={handleHexChange}
          onBlur={handleHexBlur}
          placeholder="#000000"
          maxLength={7}
          className="w-28 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
