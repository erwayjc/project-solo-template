import Link from "next/link";

export function CtaSection({ data }: { data: Record<string, unknown> }) {
  const cta = data.cta as { text?: string; url?: string } | undefined;

  return (
    <section className="bg-blue-600 py-16">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="text-3xl font-bold text-white">
          {(data.headline as string) || "Ready to get started?"}
        </h2>
        {!!data.body && (
          <p className="mt-4 text-lg text-blue-100">{data.body as string}</p>
        )}
        {cta?.url && (
          <Link
            href={cta.url}
            className="mt-8 inline-block rounded-md bg-white px-8 py-3 text-lg font-medium text-blue-600 hover:bg-blue-50"
          >
            {cta.text || "Get Started"}
          </Link>
        )}
      </div>
    </section>
  );
}
