"use client";

import { cn } from "@/lib/utils/cn";

interface PipelineItem {
  id: string;
  title: string;
  subtitle?: string;
  metadata?: string;
}

interface PipelineColumn {
  id: string;
  label: string;
  color?: string;
  items: PipelineItem[];
}

interface PipelineBoardProps {
  columns: PipelineColumn[];
  onItemClick?: (item: { id: string; title: string }) => void;
  className?: string;
}

const DEFAULT_COLOR = "#6b7280";

export function PipelineBoard({
  columns,
  onItemClick,
  className,
}: PipelineBoardProps) {
  return (
    <div
      className={cn(
        "flex gap-4 overflow-x-auto pb-4",
        className,
      )}
    >
      {columns.map((column) => (
        <div
          key={column.id}
          className="flex w-72 shrink-0 flex-col rounded-lg border bg-gray-50"
        >
          <div
            className="flex items-center justify-between rounded-t-lg px-4 py-3"
            style={{
              borderBottom: `2px solid ${column.color ?? DEFAULT_COLOR}`,
            }}
          >
            <h3 className="text-sm font-semibold text-gray-900">
              {column.label}
            </h3>
            <span
              className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-medium text-white"
              style={{ backgroundColor: column.color ?? DEFAULT_COLOR }}
            >
              {column.items.length}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-2 p-3">
            {column.items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "rounded-md border bg-white p-3 shadow-sm transition-shadow",
                  onItemClick && "cursor-pointer hover:shadow-md",
                )}
                onClick={
                  onItemClick
                    ? () => onItemClick({ id: item.id, title: item.title })
                    : undefined
                }
              >
                <p className="text-sm font-medium text-gray-900">
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="mt-1 text-xs text-gray-500">{item.subtitle}</p>
                )}
                {item.metadata && (
                  <p className="mt-2 text-xs text-gray-400">{item.metadata}</p>
                )}
              </div>
            ))}
            {column.items.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-400">
                No items
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
