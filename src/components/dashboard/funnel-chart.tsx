import { cn } from "@/lib/utils/cn";

interface FunnelStage {
  label: string;
  value: number;
  color?: string;
}

interface FunnelChartProps {
  stages: FunnelStage[];
  className?: string;
}

const defaultColors = [
  "bg-blue-500",
  "bg-blue-400",
  "bg-sky-400",
  "bg-sky-300",
  "bg-cyan-300",
];

export function FunnelChart({ stages, className }: FunnelChartProps) {
  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className={cn("rounded-lg border bg-white p-6 shadow-sm", className)}>
      <div className="space-y-3">
        {stages.map((stage, index) => {
          const widthPct = (stage.value / maxValue) * 100;
          const isCustomColor =
            stage.color && !stage.color.startsWith("bg-");
          const colorClass = isCustomColor
            ? undefined
            : stage.color ?? defaultColors[index % defaultColors.length];

          return (
            <div key={stage.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{stage.label}</span>
                <span className="text-gray-500">
                  {stage.value.toLocaleString()}
                </span>
              </div>
              <div className="h-8 w-full rounded bg-gray-100">
                <div
                  className={cn("h-full rounded", colorClass)}
                  style={{
                    width: `${widthPct}%`,
                    ...(isCustomColor
                      ? { backgroundColor: stage.color }
                      : {}),
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
