import { cn } from "@/lib/utils/cn";

interface KbdProps {
  children: React.ReactNode;
  className?: string;
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-500",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
