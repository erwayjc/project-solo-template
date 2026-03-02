"use client";

import { cn } from "@/lib/utils/cn";

interface RevenueDataPoint {
  label: string;
  value: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
  className?: string;
}

export function RevenueChart({ data, className }: RevenueChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn("rounded-lg border bg-white p-6 shadow-sm", className)}>
      <div className="flex items-end gap-2" style={{ height: 200 }}>
        {data.map((point) => {
          const heightPct = (point.value / maxValue) * 100;

          return (
            <div
              key={point.label}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <span className="text-xs font-medium text-gray-600">
                {typeof point.value === "number"
                  ? point.value.toLocaleString()
                  : point.value}
              </span>
              <div className="flex w-full items-end" style={{ height: 160 }}>
                <div
                  className="w-full rounded-t bg-blue-500 transition-all"
                  style={{ height: `${heightPct}%`, minHeight: 2 }}
                />
              </div>
              <span className="text-xs text-gray-400">{point.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
