import { cn } from "@/lib/utils/cn";

const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-3",
} as const;

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

export function LoadingSpinner({
  size = "md",
  label,
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      role="status"
    >
      <div
        className={cn(
          "animate-spin rounded-full border-gray-300 border-t-gray-900",
          sizeClasses[size],
        )}
      />
      {label && <p className="text-sm text-gray-500">{label}</p>}
      <span className="sr-only">{label ?? "Loading..."}</span>
    </div>
  );
}
