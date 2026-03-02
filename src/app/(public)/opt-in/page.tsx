import { createClient } from "@/lib/supabase/server";
import { SectionRenderer } from "@/components/public/section-renderer";

export const metadata = {
  title: "Free Resource",
};

export default async function OptInPage() {
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("pages")
    .select("sections, seo")
    .eq("slug", "opt-in")
    .eq("is_published", true)
    .single();

  const sections = (page?.sections as Record<string, unknown>[]) || [];

  return (
    <div>
      {sections.map((section, index) => (
        <SectionRenderer key={index} section={section} />
      ))}
    </div>
  );
}
