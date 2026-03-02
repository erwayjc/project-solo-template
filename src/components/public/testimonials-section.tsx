export function TestimonialsSection({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const items =
    (data.items as { name: string; quote: string; role?: string }[]) || [];

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        {!!data.headline && (
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            {data.headline as string}
          </h2>
        )}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <blockquote
              key={index}
              className="rounded-lg border bg-gray-50 p-6"
            >
              <p className="text-gray-700">&ldquo;{item.quote}&rdquo;</p>
              <footer className="mt-4">
                <p className="font-semibold text-gray-900">{item.name}</p>
                {item.role && (
                  <p className="text-sm text-gray-500">{item.role}</p>
                )}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
