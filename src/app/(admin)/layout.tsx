import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminHeader } from "@/components/layout/admin-header";
import { FloatingAgentWidget } from "@/components/agent/floating-agent-widget";
import { getOnboardingProgress } from "@/actions/onboarding";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/portal");
  }

  const onboardingProgress = await getOnboardingProgress();

  return (
    <div className="flex min-h-screen">
      <AdminSidebar onboardingProgress={onboardingProgress} />
      <div className="flex flex-1 flex-col">
        <AdminHeader />
        <main className="flex-1 overflow-auto bg-gray-50 p-6">{children}</main>
      </div>
      <FloatingAgentWidget />
    </div>
  );
}
