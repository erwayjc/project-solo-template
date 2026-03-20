export function FeaturesSection({ data }: { data: Record<string, unknown> }) {
  const items =
    (data.items as { icon: string; title: string; description: string }[]) ||
    [];

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-4">
        {!!data.headline && (
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {data.headline as string}
          </h2>
        )}
        {!!data.subtitle && (
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-gray-600">
            {data.subtitle as string}
          </p>
        )}
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-200 p-6 transition-colors hover:border-gray-300"
            >
              {!!item.icon && (
                <span className="text-3xl">{item.icon}</span>
              )}
              <h3 className="mt-3 text-lg font-semibold text-gray-900">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
