import { createClient } from "@/lib/supabase/server";
import { SectionRenderer } from "@/components/public/section-renderer";

export const metadata = {
  title: "Terms of Service",
};

export default async function TermsPage() {
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("pages")
    .select("sections")
    .eq("slug", "terms-of-service")
    .single();

  const sections = (page?.sections as Record<string, unknown>[]) || [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
      <div className="prose prose-lg mt-8 max-w-none">
        {sections.map((section, index) => (
          <SectionRenderer key={index} section={section} />
        ))}
      </div>
    </div>
  );
}
