/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

export function FeatureHighlightSection({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const layout = (data.layout as string) || "image_right";
  const cta = data.cta as { text?: string; url?: string } | undefined;
  const imageUrl = data.image_url as string | undefined;
  const imageAlt = (data.image_alt as string) || "";

  const textContent = (
    <div className="flex flex-col justify-center">
      {!!data.headline && (
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          {data.headline as string}
        </h2>
      )}
      {!!data.body && (
        <p className="mt-4 text-lg leading-relaxed text-gray-600">
          {data.body as string}
        </p>
      )}
      {cta?.url && (
        <div className="mt-6">
          <Link
            href={cta.url}
            className="inline-block rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {cta.text || "Learn More"}
          </Link>
        </div>
      )}
    </div>
  );

  const imageContent = (
    <div className="flex items-center justify-center">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={imageAlt}
          className="rounded-lg object-cover shadow-lg"
        />
      ) : (
        <div className="aspect-video w-full rounded-lg bg-gradient-to-br from-blue-100 to-blue-50" />
      )}
    </div>
  );

  return (
    <section className="bg-white py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 md:grid-cols-2">
        {layout === "image_left" ? (
          <>
            {imageContent}
            {textContent}
          </>
        ) : (
          <>
            {textContent}
            {imageContent}
          </>
        )}
      </div>
    </section>
  );
}
