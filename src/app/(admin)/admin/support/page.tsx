import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Support - Admin" };

export default async function SupportQueuePage() {
  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("*, profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Support Queue</h1>
      <div className="mt-6 overflow-hidden rounded-lg border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {tickets?.map((ticket) => {
              const profile = ticket.profiles as {
                full_name?: string;
                email?: string;
              } | null;
              return (
                <tr key={ticket.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {ticket.subject}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {profile?.full_name || profile?.email || "Unknown"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        ticket.status === "open"
                          ? "bg-yellow-100 text-yellow-700"
                          : ticket.status === "escalated"
                            ? "bg-red-100 text-red-700"
                            : ticket.status === "resolved"
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {ticket.priority}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
