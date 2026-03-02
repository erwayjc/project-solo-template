import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard - Admin" };

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { count: leadCount },
    { count: customerCount },
    { count: ticketCount },
    { count: postCount },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "customer"),
    supabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "escalated"]),
    supabase
      .from("blog_posts")
      .select("*", { count: "exact", head: true })
      .eq("status", "published"),
  ]);

  const metrics = [
    { label: "Total Leads", value: leadCount ?? 0 },
    { label: "Customers", value: customerCount ?? 0 },
    { label: "Open Tickets", value: ticketCount ?? 0 },
    { label: "Published Posts", value: postCount ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">CEO Dashboard</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border bg-white p-6">
            <p className="text-sm font-medium text-gray-500">{m.label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
