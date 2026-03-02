"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";

interface DateDisplayProps {
  date: string | Date;
  format?: "relative" | "short" | "long";
  className?: string;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function formatRelative(date: Date): string {
  const now = Date.now();
  const diffSeconds = Math.round((now - date.getTime()) / 1000);

  if (diffSeconds < 0) {
    return "just now";
  }
  if (diffSeconds < MINUTE) {
    return "just now";
  }
  if (diffSeconds < HOUR) {
    const minutes = Math.floor(diffSeconds / MINUTE);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }
  if (diffSeconds < DAY) {
    const hours = Math.floor(diffSeconds / HOUR);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  if (diffSeconds < WEEK) {
    const days = Math.floor(diffSeconds / DAY);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }
  if (diffSeconds < MONTH) {
    const weeks = Math.floor(diffSeconds / WEEK);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }
  if (diffSeconds < YEAR) {
    const months = Math.floor(diffSeconds / MONTH);
    return `${months} ${months === 1 ? "month" : "months"} ago`;
  }

  const years = Math.floor(diffSeconds / YEAR);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

function formatShort(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatLong(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DateDisplay({
  date,
  format = "short",
  className,
}: DateDisplayProps) {
  const parsed = useMemo(() => (date instanceof Date ? date : new Date(date)), [date]);

  const formatted = useMemo(() => {
    switch (format) {
      case "relative":
        return formatRelative(parsed);
      case "long":
        return formatLong(parsed);
      case "short":
      default:
        return formatShort(parsed);
    }
  }, [parsed, format]);

  return (
    <time
      dateTime={parsed.toISOString()}
      className={cn("text-sm text-gray-500", className)}
      title={formatLong(parsed)}
    >
      {formatted}
    </time>
  );
}
