import { notFound } from "next/navigation";
import Link from "next/link";
import { getPage } from "@/actions/pages";
import { PageForm } from "@/components/admin/page-form";

interface EditPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: EditPageProps) {
  const { slug } = await params;
  return { title: `Edit ${slug} - Admin` };
}

export default async function EditPagePage({ params }: EditPageProps) {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) {
    notFound();
  }

  const seo = page.seo as Record<string, string> | null;
  const title = seo?.title || page.slug;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/pages"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Pages
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              page.is_published
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {page.is_published ? "Published" : "Draft"}
          </span>
        </div>
      </div>
      <PageForm page={page} />
    </div>
  );
}
