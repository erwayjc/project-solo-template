import { cn } from "@/lib/utils/cn";

interface LessonCardProps {
  id: string;
  title: string;
  duration?: string;
  isCompleted?: boolean;
  isLocked?: boolean;
  onClick?: () => void;
  className?: string;
}

export function LessonCard({
  id,
  title,
  duration,
  isCompleted,
  isLocked,
  onClick,
  className,
}: LessonCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLocked}
      data-lesson-id={id}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border bg-white px-4 py-3 text-left transition-colors",
        isLocked
          ? "cursor-not-allowed opacity-60"
          : "hover:border-blue-300 hover:bg-blue-50",
        isCompleted && "border-green-200 bg-green-50",
        className,
      )}
    >
      {/* Status icon */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        {isCompleted ? (
          <svg
            className="h-5 w-5 text-green-600"
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
        ) : isLocked ? (
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        ) : (
          <span className="h-3 w-3 rounded-full border-2 border-gray-300" />
        )}
      </span>

      {/* Title */}
      <span className="flex-1 text-sm font-medium text-gray-900">{title}</span>

      {/* Duration */}
      {duration && (
        <span className="shrink-0 text-xs text-gray-500">{duration}</span>
      )}
    </button>
  );
}
