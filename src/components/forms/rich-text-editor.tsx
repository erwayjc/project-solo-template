"use client";

import { useRef, useCallback } from "react";
import { Bold, Italic, Heading2, Link, List } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  className?: string;
}

interface ToolbarAction {
  icon: React.ReactNode;
  label: string;
  prefix: string;
  suffix: string;
  block?: boolean;
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  {
    icon: <Bold className="h-4 w-4" />,
    label: "Bold",
    prefix: "**",
    suffix: "**",
  },
  {
    icon: <Italic className="h-4 w-4" />,
    label: "Italic",
    prefix: "_",
    suffix: "_",
  },
  {
    icon: <Heading2 className="h-4 w-4" />,
    label: "Heading",
    prefix: "## ",
    suffix: "",
    block: true,
  },
  {
    icon: <Link className="h-4 w-4" />,
    label: "Link",
    prefix: "[",
    suffix: "](url)",
  },
  {
    icon: <List className="h-4 w-4" />,
    label: "List",
    prefix: "- ",
    suffix: "",
    block: true,
  },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something...",
  minRows = 6,
  className,
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormat = useCallback(
    (action: ToolbarAction) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = value.slice(start, end);

      let newValue: string;
      let cursorPos: number;

      if (action.block) {
        // For block-level formatting, insert at the beginning of the line
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const before = value.slice(0, lineStart);
        const after = value.slice(lineStart);

        newValue = before + action.prefix + after;
        cursorPos = start + action.prefix.length;
      } else if (selected) {
        // Wrap selection
        const before = value.slice(0, start);
        const after = value.slice(end);
        newValue = before + action.prefix + selected + action.suffix + after;
        cursorPos = end + action.prefix.length + action.suffix.length;
      } else {
        // Insert placeholder
        const before = value.slice(0, start);
        const after = value.slice(end);
        const placeholder = "text";
        newValue =
          before + action.prefix + placeholder + action.suffix + after;
        cursorPos = start + action.prefix.length;
      }

      onChange(newValue);

      // Restore focus and selection after React re-render
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [value, onChange],
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500",
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b bg-gray-50 px-2 py-1.5">
        {TOOLBAR_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => applyFormat(action)}
            title={action.label}
            className="rounded p-1.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
          >
            {action.icon}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={minRows}
        className="w-full resize-y border-0 px-3 py-2 text-sm focus:outline-none"
      />
    </div>
  );
}
