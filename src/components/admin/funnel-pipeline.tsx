"use client";

interface StepStat {
  step_id: string;
  step_order: number;
  step_type: string;
  expected_action: string;
  page_title: string;
  page_slug: string;
  is_published: boolean;
  views: number;
  conversions: number;
  conversion_rate: number;
}

interface FunnelPipelineProps {
  steps: StepStat[];
  overallRate: number;
}

const stepTypeLabels: Record<string, string> = {
  landing: "Landing",
  thank_you: "Thank You",
  sales: "Sales",
  upsell: "Upsell",
  content: "Content",
};

function rateColor(rate: number): string {
  if (rate >= 20) return "text-green-600";
  if (rate >= 10) return "text-yellow-600";
  return "text-red-600";
}

function rateBorder(rate: number): string {
  if (rate >= 20) return "border-green-200";
  if (rate >= 10) return "border-yellow-200";
  return "border-red-200";
}

export function FunnelPipeline({ steps, overallRate }: FunnelPipelineProps) {
  if (steps.length === 0) {
    return (
      <div className="mt-8 text-center text-sm text-gray-500">
        No steps in this funnel yet.
      </div>
    );
  }

  return (
    <div className="mt-8">
      {/* Horizontal pipeline */}
      <div className="flex items-start gap-2 overflow-x-auto pb-4">
        {steps.map((step, index) => (
          <div key={step.step_id} className="flex items-start">
            {/* Step card */}
            <div
              className={`flex-shrink-0 w-52 rounded-lg border-2 bg-white p-4 shadow-sm ${rateBorder(step.conversion_rate)}`}
            >
              {/* Step type badge */}
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                  {stepTypeLabels[step.step_type] || step.step_type}
                </span>
                <span className="text-xs text-gray-400">#{step.step_order}</span>
              </div>

              {/* Page title */}
              <h3 className="text-sm font-semibold text-gray-900 truncate" title={step.page_title}>
                {step.page_title}
              </h3>
              <p className="text-xs text-gray-400 truncate">/p/{step.page_slug}</p>

              {/* Metrics */}
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Views</span>
                  <span className="font-medium text-gray-900">
                    {step.views.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Conversions</span>
                  <span className="font-medium text-gray-900">
                    {step.conversions.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Rate</span>
                  <span className={`font-bold ${rateColor(step.conversion_rate)}`}>
                    {step.conversion_rate}%
                  </span>
                </div>
              </div>

              {/* Status */}
              {!step.is_published && (
                <div className="mt-2">
                  <span className="text-xs text-orange-500">Draft</span>
                </div>
              )}
            </div>

            {/* Arrow connector */}
            {index < steps.length - 1 && (
              <div className="flex items-center self-center px-1">
                <svg
                  width="24"
                  height="16"
                  viewBox="0 0 24 16"
                  fill="none"
                  className="text-gray-300"
                >
                  <path
                    d="M0 8H20M20 8L14 2M20 8L14 14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Overall rate */}
      <div className="mt-6 flex items-center gap-2 rounded-lg border bg-gray-50 px-4 py-3">
        <span className="text-sm font-medium text-gray-600">
          Overall Funnel Conversion Rate:
        </span>
        <span className={`text-lg font-bold ${rateColor(overallRate)}`}>
          {overallRate}%
        </span>
        <span className="text-xs text-gray-400">
          (first step views &rarr; last step conversions)
        </span>
      </div>
    </div>
  );
}
