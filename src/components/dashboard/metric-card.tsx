import { cn } from "@/lib/utils/cn";

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({
  label,
  value,
  change,
  icon,
  className,
}: MetricCardProps) {
  const isPositive = change !== undefined && change >= 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-6 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        {icon && (
          <span className="text-gray-400">{icon}</span>
        )}
      </div>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
      {change !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-sm">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              isPositive && "text-green-600",
              isNegative && "text-red-600",
            )}
          >
            <svg
              className={cn("h-4 w-4", isNegative && "rotate-180")}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 15l7-7 7 7"
              />
            </svg>
            {Math.abs(change)}%
          </span>
          <span className="text-gray-400">vs last period</span>
        </div>
      )}
    </div>
  );
}
