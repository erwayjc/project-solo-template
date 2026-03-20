import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionRenderer } from "@/components/public/section-renderer";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: page } = await supabase
    .from("pages")
    .select("seo")
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("container_type", "website")
    .single();

  if (!page) return {};

  const seo = page.seo as Record<string, string> | null;
  return {
    title: seo?.title || slug,
    description: seo?.description || "",
    openGraph: {
      title: seo?.title || slug,
      description: seo?.description || "",
      ...(seo?.og_image ? { images: [seo.og_image] } : {}),
    },
  };
}

export default async function WebsitePage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: page } = await supabase
    .from("pages")
    .select("id, slug, sections, render_mode, is_published, container_type")
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("container_type", "website")
    .single();

  if (!page) {
    notFound();
  }

  // Custom HTML pages are served at /p/[slug], not here
  if (page.render_mode === "custom") {
    notFound();
  }

  // Fire-and-forget view count increment
  supabase
    .rpc("increment_page_view_count" as never, { page_id: page.id } as never)
    .then(() => {})
    .catch((err: unknown) =>
      console.error("Failed to increment page views:", err)
    );

  const sections = Array.isArray(page.sections)
    ? (page.sections as (Record<string, unknown> & { id?: string })[])
    : [];

  return (
    <div>
      {sections.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-gray-400">This page has no content yet.</p>
        </div>
      ) : (
        sections.map((section, index) => (
          <SectionRenderer
            key={
              section.id ?? `${String(section.type ?? "section")}-${index}`
            }
            section={section}
          />
        ))
      )}
    </div>
  );
}
