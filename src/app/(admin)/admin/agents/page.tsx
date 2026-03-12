import { createClient } from "@/lib/supabase/server";
import { AgentActivationCard } from "@/components/admin/agent-activation-card";
import type { AgentSchedule, AgentTrigger, AgentStatus } from "@/types/database";

export const metadata = { title: "Agents - Admin" };

export default async function AgentsPage() {
  const supabase = await createClient();

  const [agentsRes, schedulesRes, triggersRes, statusesRes] = await Promise.all(
    [
      supabase
        .from("agents")
        .select("*")
        .order("is_system", { ascending: false })
        .order("name"),
      supabase
        .from("agent_schedules")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("agent_triggers")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("agent_status").select("*"),
    ]
  );

  const agents = agentsRes.data ?? [];
  const schedules = (schedulesRes.data ?? []) as AgentSchedule[];
  const triggers = (triggersRes.data ?? []) as AgentTrigger[];
  const statuses = (statusesRes.data ?? []) as AgentStatus[];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">AI Agents</h1>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <AgentActivationCard
            key={agent.id}
            agent={agent}
            schedules={schedules.filter((s) => s.agent_id === agent.id)}
            triggers={triggers.filter((t) => t.agent_id === agent.id)}
            status={statuses.find((s) => s.agent_id === agent.id) ?? null}
          />
        ))}
      </div>
    </div>
  );
}
