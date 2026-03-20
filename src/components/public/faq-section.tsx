export function FaqSection({ data }: { data: Record<string, unknown> }) {
  const items =
    (data.items as { question: string; answer: string }[]) || [];

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-3xl px-4">
        {!!data.headline && (
          <h2 className="mb-10 text-center text-3xl font-bold text-gray-900">
            {data.headline as string}
          </h2>
        )}
        <div className="divide-y divide-gray-200">
          {items.map((item, index) => (
            <details key={index} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-left font-medium text-gray-900">
                <span>{item.question}</span>
                <span className="ml-4 flex-shrink-0 text-gray-400 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-gray-600 leading-relaxed">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
