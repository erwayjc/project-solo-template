import { getPageTemplates } from "@/actions/page-templates";
import { TemplateGallery } from "@/components/admin/template-gallery";

export const metadata = { title: "Page Templates - Admin" };

export default async function PageTemplatesPage() {
  const templates = await getPageTemplates();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Page Templates</h1>
      <p className="mt-1 text-sm text-gray-500">
        Starter templates your Dev Agent can customize for you. Pick one and ask
        the agent to build your page.
      </p>

      <TemplateGallery templates={templates} />
    </div>
  );
}
