"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface ModuleAccordionProps {
  title: string;
  lessonCount: number;
  completedCount: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function ModuleAccordion({
  title,
  lessonCount,
  completedCount,
  children,
  defaultOpen = false,
  className,
}: ModuleAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const allCompleted = lessonCount > 0 && completedCount >= lessonCount;

  return (
    <div
      className={cn(
        "rounded-lg border bg-white shadow-sm",
        allCompleted && "border-green-200",
        className,
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          {allCompleted && (
            <svg
              className="h-5 w-5 shrink-0 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
          <span className="text-sm font-semibold text-gray-900">{title}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {completedCount}/{lessonCount} completed
          </span>
          <svg
            className={cn(
              "h-4 w-4 text-gray-400 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Content */}
      {isOpen && (
        <div className="flex flex-col gap-2 border-t px-5 py-4">{children}</div>
      )}
    </div>
  );
}
