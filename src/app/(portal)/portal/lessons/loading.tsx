export default function LessonsLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
      <div className="mt-8 space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-white p-6">
            <div className="flex items-center justify-between">
              <div className="h-6 w-56 animate-pulse rounded bg-gray-200" />
              <div className="h-5 w-20 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="mt-3 h-4 w-80 animate-pulse rounded bg-gray-100" />
            <div className="mt-4 space-y-2">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <div className="h-6 w-6 animate-pulse rounded-full bg-gray-100" />
                  <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
