"use client";

import { cn } from "@/lib/utils/cn";
import { useMemo } from "react";

interface CalendarItem {
  id: string;
  title: string;
  date: string;
  color?: string;
}

interface CalendarViewProps {
  items: CalendarItem[];
  month?: number;
  year?: number;
  onDateClick?: (date: string) => void;
  className?: string;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function CalendarView({
  items,
  month,
  year,
  onDateClick,
  className,
}: CalendarViewProps) {
  const now = new Date();
  const displayMonth = month ?? now.getMonth() + 1;
  const displayYear = year ?? now.getFullYear();

  const { days, startDay, monthLabel } = useMemo(() => {
    const firstDay = new Date(displayYear, displayMonth - 1, 1);
    const lastDay = new Date(displayYear, displayMonth, 0);
    return {
      days: lastDay.getDate(),
      startDay: firstDay.getDay(),
      monthLabel: firstDay.toLocaleString("default", {
        month: "long",
        year: "numeric",
      }),
    };
  }, [displayMonth, displayYear]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = item.date.slice(0, 10);
      const existing = map.get(key);
      if (existing) {
        existing.push(item);
      } else {
        map.set(key, [item]);
      }
    }
    return map;
  }, [items]);

  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  return (
    <div className={cn("rounded-lg border bg-white shadow-sm", className)}>
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">{monthLabel}</h3>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-7 gap-px">
          {DAY_LABELS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-gray-500"
            >
              {day}
            </div>
          ))}
          {Array.from({ length: startDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[4.5rem] p-1" />
          ))}
          {Array.from({ length: days }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${displayYear}-${pad(displayMonth)}-${pad(dayNum)}`;
            const dayItems = itemsByDate.get(dateStr) ?? [];
            const isToday = dateStr === todayStr;

            return (
              <div
                key={dayNum}
                className={cn(
                  "min-h-[4.5rem] rounded-md border border-transparent p-1 transition-colors",
                  isToday && "border-blue-200 bg-blue-50",
                  onDateClick && "cursor-pointer hover:bg-gray-50",
                )}
                onClick={onDateClick ? () => onDateClick(dateStr) : undefined}
              >
                <span
                  className={cn(
                    "inline-block text-xs font-medium",
                    isToday ? "text-blue-600" : "text-gray-700",
                  )}
                >
                  {dayNum}
                </span>
                <div className="mt-0.5 flex flex-col gap-0.5">
                  {dayItems.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="truncate rounded px-1 py-0.5 text-[0.625rem] leading-tight text-white"
                      style={{ backgroundColor: item.color ?? "#3b82f6" }}
                      title={item.title}
                    >
                      {item.title}
                    </div>
                  ))}
                  {dayItems.length > 3 && (
                    <span className="px-1 text-[0.625rem] text-gray-400">
                      +{dayItems.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
