import { cn } from "@/lib/utils/cn";

interface ActivityItem {
  id: string;
  description: string;
  timestamp: string;
  icon?: React.ReactNode;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  className?: string;
}

export function ActivityFeed({ items, className }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className={cn("rounded-lg border bg-white p-6 shadow-sm", className)}>
        <p className="text-sm text-gray-500">No recent activity.</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-white shadow-sm", className)}>
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 px-6 py-4">
            {item.icon ? (
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                {item.icon}
              </span>
            ) : (
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                  />
                </svg>
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-900">{item.description}</p>
              <p className="mt-0.5 text-xs text-gray-400">{item.timestamp}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
