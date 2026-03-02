"use client";

import { cn } from "@/lib/utils/cn";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div
      className={cn(
        "flex items-center justify-between",
        className,
      )}
    >
      <button
        type="button"
        disabled={!hasPrev}
        onClick={() => onPageChange(currentPage - 1)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
          hasPrev
            ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300",
        )}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Previous
      </button>

      <span className="text-sm text-gray-600">
        Page{" "}
        <span className="font-medium text-gray-900">{currentPage}</span>
        {" "}of{" "}
        <span className="font-medium text-gray-900">{totalPages}</span>
      </span>

      <button
        type="button"
        disabled={!hasNext}
        onClick={() => onPageChange(currentPage + 1)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
          hasNext
            ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300",
        )}
      >
        Next
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  );
}
