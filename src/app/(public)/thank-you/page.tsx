import { createClient } from "@/lib/supabase/server";
import { SectionRenderer } from "@/components/public/section-renderer";

export const metadata = {
  title: "Thank You",
};

export default async function ThankYouPage() {
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("pages")
    .select("sections, seo")
    .eq("slug", "thank-you")
    .eq("is_published", true)
    .single();

  const sections = (page?.sections as Record<string, unknown>[]) || [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      {sections.length > 0 ? (
        sections.map((section, index) => (
          <SectionRenderer key={index} section={section} />
        ))
      ) : (
        <>
          <h1 className="text-3xl font-bold text-gray-900">Thank you!</h1>
          <p className="mt-4 text-lg text-gray-600">
            Check your email for your free resource.
          </p>
        </>
      )}
    </div>
  );
}
