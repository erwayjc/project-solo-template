import { createClient } from "@/lib/supabase/server";
import { UpdateManager } from "@/components/admin/updates/update-manager";
import type { UpdateHistoryEntry } from "@/actions/updates";

export const metadata = { title: "Updates - Admin" };

export default async function UpdatesPage() {
  const supabase = await createClient();
  const { data: config } = await supabase
    .from("site_config")
    .select("template_version, last_migration_number, update_history")
    .eq("id", 1)
    .single();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Updates</h1>
      <p className="mt-1 text-sm text-gray-500">
        Check for and apply upstream template updates.
      </p>

      <div className="mt-8">
        <UpdateManager
          currentVersion={config?.template_version || "0.0.0"}
          lastMigrationNumber={config?.last_migration_number || 0}
          updateHistory={
            (config?.update_history as unknown as UpdateHistoryEntry[]) || []
          }
        />
      </div>
    </div>
  );
}
