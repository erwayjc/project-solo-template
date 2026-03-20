import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { getPublishedWebsitePages } from "@/actions/pages";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pages = await getPublishedWebsitePages();

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader pages={pages} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
