export default function AgentDetailLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-8 w-48 animate-pulse rounded-md bg-gray-200" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-gray-100" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-4 border-b pb-2">
        <div className="h-8 w-16 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-20 animate-pulse rounded bg-gray-100" />
        <div className="h-8 w-16 animate-pulse rounded bg-gray-100" />
      </div>

      {/* Content skeleton */}
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}
