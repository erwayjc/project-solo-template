import { cn } from "@/lib/utils/cn";

interface FieldGroupProps {
  label: string;
  htmlFor?: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FieldGroup({
  label,
  htmlFor,
  description,
  error,
  required,
  children,
  className,
}: FieldGroupProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      {description && (
        <p className="text-sm text-gray-500">{description}</p>
      )}

      {children}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
