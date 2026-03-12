"use client";

import { useState } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import type { AgentRun, Agent } from "@/types/database";

interface AgentRunLogProps {
  initialRuns: AgentRun[];
  agents: Agent[];
}

const triggerColors: Record<string, string> = {
  schedule: "bg-blue-100 text-blue-700",
  event: "bg-purple-100 text-purple-700",
  goal: "bg-amber-100 text-amber-700",
  manual: "bg-gray-100 text-gray-600",
};

const statusColors: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  running: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
  pending: "bg-yellow-100 text-yellow-700",
};

export function AgentRunLog({ initialRuns, agents }: AgentRunLogProps) {
  const { data: runs } = useRealtime<AgentRun & Record<string, unknown>>({
    table: "agent_runs",
    initialData: initialRuns as (AgentRun & Record<string, unknown>)[],
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  const agentMap = new Map(agents.map((a) => [a.id, a]));

  // Sort newest first
  const sorted = [...runs].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-gray-400">
        No agent runs yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((run) => {
        const agent = agentMap.get(run.agent_id);
        const isOpen = expanded === run.id;
        const duration =
          run.completed_at && run.started_at
            ? Math.round(
                (new Date(run.completed_at).getTime() -
                  new Date(run.started_at).getTime()) /
                  1000
              )
            : null;

        return (
          <div
            key={run.id}
            className="rounded-lg border bg-white cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setExpanded(isOpen ? null : run.id)}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-sm">{agent?.icon ?? "?"}</span>
              <span className="text-sm font-medium text-gray-900 truncate">
                {agent?.name ?? "Unknown"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  triggerColors[run.trigger_type] ?? triggerColors.manual
                }`}
              >
                {run.trigger_type}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  statusColors[run.status] ?? statusColors.pending
                }`}
              >
                {run.status}
              </span>
              <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
                {duration !== null && `${duration}s · `}
                {new Date(run.created_at).toLocaleTimeString()}
              </span>
            </div>

            {isOpen && (
              <div className="border-t px-4 py-3 space-y-2 text-sm">
                {run.prompt && (
                  <div>
                    <p className="text-xs font-medium text-gray-500">Prompt</p>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {run.prompt}
                    </p>
                  </div>
                )}
                {run.response && (
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      Response
                    </p>
                    <p className="text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {run.response}
                    </p>
                  </div>
                )}
                {run.error_message && (
                  <div>
                    <p className="text-xs font-medium text-red-500">Error</p>
                    <p className="text-red-600">{run.error_message}</p>
                  </div>
                )}
                <div className="flex gap-4 text-xs text-gray-400">
                  {run.tokens_used && <span>Tokens: {run.tokens_used}</span>}
                  {run.tool_calls && (
                    <span>
                      Tool calls:{" "}
                      {Array.isArray(run.tool_calls)
                        ? run.tool_calls.length
                        : 0}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
