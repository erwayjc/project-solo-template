import Link from "next/link";

export function BlogCard({
  title,
  slug,
  excerpt,
  image,
  date,
}: {
  title: string;
  slug: string;
  excerpt?: string;
  image?: string;
  date?: string;
}) {
  return (
    <article className="overflow-hidden rounded-lg border bg-white shadow-sm">
      {image && (
        /* eslint-disable-next-line @next/next/no-img-element -- dynamic user-provided URL */
        <img src={image} alt={title} className="h-48 w-full object-cover" />
      )}
      <div className="p-6">
        <Link href={`/blog/${slug}`}>
          <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600">
            {title}
          </h3>
        </Link>
        {excerpt && <p className="mt-2 text-sm text-gray-600">{excerpt}</p>}
        {date && (
          <time className="mt-3 block text-sm text-gray-400">
            {new Date(date).toLocaleDateString()}
          </time>
        )}
      </div>
    </article>
  );
}
