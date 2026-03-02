import { cn } from "@/lib/utils/cn";

type ServiceStatus = "connected" | "disconnected" | "error";

interface Service {
  name: string;
  status: ServiceStatus;
  lastChecked?: string;
}

interface HealthStatusProps {
  services: Service[];
  className?: string;
}

const statusConfig: Record<
  ServiceStatus,
  { dot: string; label: string; text: string }
> = {
  connected: {
    dot: "bg-green-500",
    label: "Connected",
    text: "text-green-700",
  },
  disconnected: {
    dot: "bg-gray-400",
    label: "Disconnected",
    text: "text-gray-500",
  },
  error: {
    dot: "bg-red-500",
    label: "Error",
    text: "text-red-700",
  },
};

export function HealthStatus({ services, className }: HealthStatusProps) {
  return (
    <div className={cn("rounded-lg border bg-white shadow-sm", className)}>
      <ul className="divide-y">
        {services.map((service) => {
          const config = statusConfig[service.status];

          return (
            <li
              key={service.name}
              className="flex items-center justify-between px-6 py-4"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn("h-2.5 w-2.5 shrink-0 rounded-full", config.dot)}
                />
                <span className="text-sm font-medium text-gray-900">
                  {service.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-xs font-medium", config.text)}>
                  {config.label}
                </span>
                {service.lastChecked && (
                  <span className="text-xs text-gray-400">
                    {service.lastChecked}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
