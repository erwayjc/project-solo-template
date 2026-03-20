/* eslint-disable @next/next/no-img-element */

export function LogoCloudSection({ data }: { data: Record<string, unknown> }) {
  const items =
    (data.items as { name: string; logo_url?: string }[]) || [];

  return (
    <section className="bg-gray-50 py-12">
      <div className="mx-auto max-w-6xl px-4">
        {!!data.headline && (
          <p className="mb-8 text-center text-sm font-medium uppercase tracking-wider text-gray-500">
            {data.headline as string}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {items.map((item, index) =>
            item.logo_url ? (
              <img
                key={index}
                src={item.logo_url}
                alt={item.name}
                className="h-8 object-contain grayscale transition-all hover:grayscale-0"
              />
            ) : (
              <span
                key={index}
                className="text-lg font-semibold text-gray-400 transition-colors hover:text-gray-600"
              >
                {item.name}
              </span>
            )
          )}
        </div>
      </div>
    </section>
  );
}
