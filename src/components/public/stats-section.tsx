export function StatsSection({ data }: { data: Record<string, unknown> }) {
  const items = (data.items as { value: string; label: string }[]) || [];

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-6xl px-4">
        {!!data.headline && (
          <h2 className="mb-10 text-center text-3xl font-bold text-gray-900">
            {data.headline as string}
          </h2>
        )}
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {items.map((item, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl font-bold tracking-tight text-blue-600">
                {item.value}
              </div>
              <div className="mt-2 text-sm font-medium text-gray-600">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
