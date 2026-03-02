export function BenefitsSection({ data }: { data: Record<string, unknown> }) {
  const items = (data.items as { title: string; description: string }[]) || [];

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-6xl px-4">
        {!!data.headline && (
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            {data.headline as string}
          </h2>
        )}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <div key={index} className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">
                {item.title}
              </h3>
              <p className="mt-2 text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
