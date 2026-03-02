import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Leads - Admin" };

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const statuses = ["new", "nurturing", "qualified", "converted", "lost"];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Lead Pipeline</h1>
      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        {statuses.map((status) => {
          const statusLeads =
            leads?.filter((l) => l.status === status) || [];
          return (
            <div key={status} className="rounded-lg border bg-gray-50 p-4">
              <h2 className="text-sm font-semibold uppercase text-gray-500">
                {status}{" "}
                <span className="text-gray-400">({statusLeads.length})</span>
              </h2>
              <div className="mt-3 space-y-2">
                {statusLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-md border bg-white p-3 shadow-sm"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {lead.name || lead.email}
                    </p>
                    <p className="text-xs text-gray-500">{lead.source}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
