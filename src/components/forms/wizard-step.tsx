import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface WizardStepProps {
  step: number;
  totalSteps: number;
  title: string;
  description?: string;
  children: React.ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  isValid?: boolean;
  isLoading?: boolean;
}

export function WizardStep({
  step,
  totalSteps,
  title,
  description,
  children,
  onNext,
  onBack,
  isValid = true,
  isLoading = false,
}: WizardStepProps) {
  const isLastStep = step === totalSteps;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Step indicator */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-500">
          Step {step} of {totalSteps}
        </p>
        <div className="mt-2 flex gap-1">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i < step ? "bg-blue-600" : "bg-gray-200",
              )}
            />
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>

      {/* Content */}
      <div className="mb-8">{children}</div>

      {/* Navigation */}
      <div className="flex justify-between border-t pt-4">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={isLoading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
          )}
        </div>
        <div>
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={!isValid || isLoading}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {isLastStep ? "Finish" : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
