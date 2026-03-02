import Link from "next/link";

export function HeroSection({ data }: { data: Record<string, unknown> }) {
  const cta = data.cta as { text?: string; url?: string } | undefined;

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
          {(data.headline as string) || "Welcome"}
        </h1>
        {!!data.body && (
          <p className="mt-6 text-lg text-gray-600">{data.body as string}</p>
        )}
        {cta?.url && (
          <Link
            href={cta.url}
            className="mt-8 inline-block rounded-md bg-blue-600 px-8 py-3 text-lg font-medium text-white hover:bg-blue-700"
          >
            {cta.text || "Get Started"}
          </Link>
        )}
      </div>
    </section>
  );
}
