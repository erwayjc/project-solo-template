import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalNav } from "@/components/layout/portal-nav";
import { PwaInstallPrompt } from "@/components/portal/pwa-install-prompt";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/portal");
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <PortalNav />
      <PwaInstallPrompt className="mx-4 mt-4 sm:mx-6 lg:mx-8" />
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
