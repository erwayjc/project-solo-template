import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { AgentDetailTabs } from "@/components/admin/agent-detail-tabs";
import type { AgentSchedule, AgentTrigger, AgentRun } from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("name")
    .eq("id", id)
    .single();
  return { title: agent ? `${agent.name} - Agents` : "Agent" };
}

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const supabase = await createClient();

  const [agentRes, schedulesRes, triggersRes, runsRes] = await Promise.all([
    supabase.from("agents").select("*").eq("id", id).single(),
    supabase
      .from("agent_schedules")
      .select("*")
      .eq("agent_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("agent_triggers")
      .select("*")
      .eq("agent_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("agent_runs")
      .select("*")
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (agentRes.error || !agentRes.data) notFound();

  const hasSecondaryErrors =
    schedulesRes.error || triggersRes.error || runsRes.error;

  return (
    <>
      {hasSecondaryErrors && (
        <div className="mx-4 mt-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Some data failed to load and may be incomplete. Try refreshing the
          page.
        </div>
      )}
      <AgentDetailTabs
        agent={agentRes.data}
        schedules={(schedulesRes.data ?? []) as AgentSchedule[]}
        triggers={(triggersRes.data ?? []) as AgentTrigger[]}
        runs={(runsRes.data ?? []) as AgentRun[]}
        initialTab={tab === "config" || tab === "runs" ? tab : "chat"}
      />
    </>
  );
}
