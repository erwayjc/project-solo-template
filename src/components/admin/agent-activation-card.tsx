"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { updateAgent } from "@/actions/agents";
import type { Agent, AgentSchedule, AgentTrigger, AgentStatus } from "@/types/database";

interface AgentActivationCardProps {
  agent: Agent;
  schedules: AgentSchedule[];
  triggers: AgentTrigger[];
  status: AgentStatus | null;
}

export function AgentActivationCard({
  agent,
  schedules,
  triggers,
  status,
}: AgentActivationCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(agent.is_active);

  const statusColor = {
    idle: "bg-gray-100 text-gray-600",
    running: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
    disabled: "bg-gray-100 text-gray-400",
  }[status?.status || "disabled"];

  const statusDot = {
    idle: "bg-gray-400",
    running: "bg-green-500 animate-pulse",
    error: "bg-red-500",
    disabled: "bg-gray-300",
  }[status?.status || "disabled"];

  function handleToggle() {
    const newValue = !isActive;
    setIsActive(newValue);
    startTransition(async () => {
      try {
        await updateAgent(agent.id, { is_active: newValue });
      } catch {
        setIsActive(!newValue);
      }
    });
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-start justify-between">
        <Link
          href={`/admin/agents/${agent.id}`}
          className="flex items-center gap-3 hover:opacity-80"
        >
          <span className="text-2xl">{agent.icon}</span>
          <div>
            <h2 className="font-semibold text-gray-900">{agent.name}</h2>
            <div className="flex items-center gap-2">
              {agent.is_system && (
                <span className="text-xs text-blue-600">System</span>
              )}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${statusColor}`}
              >
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDot}`} />
                {status?.status || "disabled"}
              </span>
            </div>
          </div>
        </Link>

        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          disabled={isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isActive ? "bg-blue-600" : "bg-gray-200"
          } ${isPending ? "opacity-50" : ""}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isActive ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{agent.description}</p>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        {status?.last_active_at && (
          <span>
            Last active:{" "}
            {new Date(status.last_active_at).toLocaleDateString()}
          </span>
        )}
        {status?.runs_today !== undefined && status.runs_today > 0 && (
          <span>{status.runs_today} runs today</span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Link
          href={`/admin/agents/${agent.id}?tab=config`}
          className="text-xs text-blue-600 hover:underline"
        >
          {schedules.length} schedule{schedules.length !== 1 ? "s" : ""}
        </Link>
        <Link
          href={`/admin/agents/${agent.id}?tab=config`}
          className="text-xs text-purple-600 hover:underline"
        >
          {triggers.length} trigger{triggers.length !== 1 ? "s" : ""}
        </Link>
      </div>
    </div>
  );
}
