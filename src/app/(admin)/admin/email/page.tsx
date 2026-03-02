import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Email - Admin" };

export default async function EmailPage() {
  const supabase = await createClient();

  const [{ data: sequences }, { data: broadcasts }] = await Promise.all([
    supabase.from("email_sequences").select("*").order("name"),
    supabase
      .from("broadcasts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Email Manager</h1>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Sequences</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {sequences?.map((seq) => (
            <div key={seq.id} className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">{seq.name}</h3>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    seq.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {seq.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Trigger: {seq.trigger}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Broadcasts</h2>
        <div className="mt-4 overflow-hidden rounded-lg border">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Sent
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {broadcasts?.map((b) => (
                <tr key={b.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {b.subject}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                      {b.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {b.sent_at
                      ? new Date(b.sent_at).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
