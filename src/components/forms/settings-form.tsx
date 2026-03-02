"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SettingsFormProps {
  onSubmit: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
}

export function SettingsForm({
  onSubmit,
  children,
  submitLabel = "Save Changes",
  className,
}: SettingsFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-6", className)}
    >
      {children}

      <div className="flex justify-end border-t pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
