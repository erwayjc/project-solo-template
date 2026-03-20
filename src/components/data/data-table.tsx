"use client";

import { cn } from "@/lib/utils/cn";
import { useState } from "react";

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
  rowActions?: (row: Record<string, unknown>) => React.ReactNode;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function DataTable({
  columns,
  data,
  onRowClick,
  rowActions,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  className,
}: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  const sortedData = sortKey
    ? [...data].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        const comparison =
          typeof aVal === "number" && typeof bVal === "number"
            ? aVal - bVal
            : String(aVal).localeCompare(String(bVal));
        return sortDirection === "asc" ? comparison : -comparison;
      })
    : data;

  const allColumns = rowActions
    ? [...columns, { key: "__actions", label: "", sortable: false }]
    : columns;

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm",
        className,
      )}
    >
      <table className="min-w-full divide-y divide-gray-100">
        <thead>
          <tr>
            {allColumns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "sticky top-0 z-10 bg-gray-50/95 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 backdrop-blur-sm",
                  col.className,
                )}
                aria-sort={
                  col.sortable && sortKey === col.key
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : col.sortable
                      ? "none"
                      : undefined
                }
              >
                {col.sortable ? (
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1 select-none transition-colors hover:text-gray-700",
                      sortKey === col.key && "text-gray-700",
                    )}
                    onClick={() => handleSort(col.key)}
                    aria-label={`Sort by ${col.label}`}
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <svg
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          sortDirection === "desc" && "rotate-180",
                        )}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    )}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {sortedData.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={cn(
                "group transition-colors",
                onRowClick && "cursor-pointer hover:bg-gray-50/50",
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-sm text-gray-900",
                    col.className,
                  )}
                >
                  {col.render
                    ? col.render(row[col.key], row)
                    : (row[col.key] as React.ReactNode) ?? "\u2014"}
                </td>
              ))}
              {rowActions && (
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="opacity-0 transition-opacity group-hover:opacity-100">
                    {rowActions(row)}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {sortedData.length === 0 && (
            <tr>
              <td
                colSpan={allColumns.length}
                className="px-4 py-12 text-center"
              >
                <div className="flex flex-col items-center gap-2">
                  {emptyIcon && (
                    <div className="text-gray-300">{emptyIcon}</div>
                  )}
                  <p className="text-sm font-medium text-gray-500">
                    {emptyTitle || "No data available"}
                  </p>
                  {emptyDescription && (
                    <p className="text-xs text-gray-400">{emptyDescription}</p>
                  )}
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
