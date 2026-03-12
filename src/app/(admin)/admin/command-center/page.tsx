import { createClient } from "@/lib/supabase/server";
import { IntegrationGate } from "@/components/shared/integration-gate";
import { AgentStatusGrid } from "@/components/admin/agent-status-grid";
import { AgentRunLog } from "@/components/admin/agent-run-log";
import { GoalTracker } from "@/components/admin/goal-tracker";
import { GoalInput } from "@/components/admin/goal-input";
import type {
  Agent,
  AgentStatus,
  AgentRun,
  Goal,
  GoalTask,
} from "@/types/database";

export const metadata = { title: "Command Center - Admin" };

export default async function CommandCenterPage() {
  const anthropicConnected = !!process.env.ANTHROPIC_API_KEY;
  const supabase = await createClient();

  const [agentsRes, statusesRes, runsRes, goalsRes] = await Promise.all([
    supabase
      .from("agents")
      .select("*")
      .order("is_system", { ascending: false })
      .order("name"),
    supabase.from("agent_status").select("*"),
    supabase
      .from("agent_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("goals")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  const agents = (agentsRes.data ?? []) as Agent[];
  const statuses = (statusesRes.data ?? []) as AgentStatus[];
  const runs = (runsRes.data ?? []) as AgentRun[];
  const goals = (goalsRes.data ?? []) as Goal[];

  // Fetch tasks for all goals
  const goalIds = goals.map((g) => g.id);
  let goalTasks: GoalTask[] = [];
  if (goalIds.length > 0) {
    const { data } = await supabase
      .from("goal_tasks")
      .select("*")
      .in("goal_id", goalIds)
      .order("order_index", { ascending: true });
    goalTasks = (data ?? []) as GoalTask[];
  }

  return (
    <IntegrationGate integration="anthropic" isConnected={anthropicConnected}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>

        {/* Agent status grid with worker banner */}
        <AgentStatusGrid initialAgents={agents} initialStatuses={statuses} />

        {/* Two-column layout: run log + goals */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Run log — wider column */}
          <div className="lg:col-span-3">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              Recent Activity
            </h2>
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-gray-50 p-3">
              <AgentRunLog initialRuns={runs} agents={agents} />
            </div>
          </div>

          {/* Goals — narrower column */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Goals</h2>
            <div className="max-h-[40vh] overflow-y-auto">
              <GoalTracker initialGoals={goals} initialTasks={goalTasks} />
            </div>
            <GoalInput />
          </div>
        </div>
      </div>
    </IntegrationGate>
  );
}
