import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Agents - Admin" };

export default async function AgentsPage() {
  const supabase = await createClient();
  const { data: agents } = await supabase
    .from("agents")
    .select("*")
    .order("is_system", { ascending: false })
    .order("name");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">AI Agents</h1>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents?.map((agent) => (
          <Link
            key={agent.id}
            href={`/admin/agents/${agent.id}`}
            className="rounded-lg border bg-white p-6 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{agent.icon}</span>
              <div>
                <h2 className="font-semibold text-gray-900">{agent.name}</h2>
                {agent.is_system && (
                  <span className="text-xs text-blue-600">System</span>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600">{agent.description}</p>
            <div className="mt-3">
              <span
                className={`inline-block rounded-full px-2 py-1 text-xs ${
                  agent.is_active
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {agent.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
