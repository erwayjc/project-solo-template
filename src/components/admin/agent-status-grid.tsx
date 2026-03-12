"use client";

import { useState, useEffect } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import type { Agent, AgentStatus } from "@/types/database";

interface AgentStatusGridProps {
  initialAgents: Agent[];
  initialStatuses: AgentStatus[];
}

const WORKER_SENTINEL_ID = "00000000-0000-0000-0000-000000000000";

export function AgentStatusGrid({
  initialAgents,
  initialStatuses,
}: AgentStatusGridProps) {
  const { data: statuses } = useRealtime<AgentStatus & Record<string, unknown>>(
    {
      table: "agent_status",
      initialData: initialStatuses as (AgentStatus & Record<string, unknown>)[],
    }
  );

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const workerStatus = statuses.find(
    (s) => s.agent_id === WORKER_SENTINEL_ID
  );
  const workerOnline =
    workerStatus &&
    now - new Date(workerStatus.updated_at).getTime() < 2 * 60 * 1000;

  const statusColor: Record<string, string> = {
    idle: "bg-gray-100 text-gray-600",
    running: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
    disabled: "bg-gray-100 text-gray-400",
  };

  const dotColor: Record<string, string> = {
    idle: "bg-gray-400",
    running: "bg-green-500 animate-pulse",
    error: "bg-red-500",
    disabled: "bg-gray-300",
  };

  return (
    <div className="space-y-3">
      {/* Worker status banner */}
      <div
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
          workerOnline
            ? "bg-green-50 text-green-700"
            : "bg-red-50 text-red-700"
        }`}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            workerOnline ? "bg-green-500 animate-pulse" : "bg-red-500"
          }`}
        />
        Worker: {workerOnline ? "Online" : "Offline"}
        {workerStatus && (
          <span className="ml-auto text-xs opacity-70">
            Last heartbeat:{" "}
            {new Date(workerStatus.updated_at).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Agent status cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {initialAgents.map((agent) => {
          const s = statuses.find((st) => st.agent_id === agent.id);
          const status = s?.status || "disabled";
          return (
            <div
              key={agent.id}
              className="flex items-center gap-3 rounded-lg border bg-white p-3"
            >
              <span className="text-xl">{agent.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {agent.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${statusColor[status] ?? statusColor.disabled}`}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor[status] ?? dotColor.disabled}`}
                    />
                    {status}
                  </span>
                  {s?.runs_today !== undefined && s.runs_today > 0 && (
                    <span className="text-xs text-gray-400">
                      {s.runs_today} runs
                    </span>
                  )}
                </div>
              </div>
              {s?.last_active_at && (
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(s.last_active_at).toLocaleTimeString()}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
