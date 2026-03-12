"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import {
  createAgentSchedule,
  updateAgentSchedule,
  deleteAgentSchedule,
} from "@/actions/agent-schedules";
import type { AgentSchedule } from "@/types/database";

const CRON_PRESETS = [
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Daily at 9am UTC", value: "0 9 * * *" },
  { label: "Weekly Monday 9am", value: "0 9 * * 1" },
  { label: "Custom", value: "" },
];

interface AgentScheduleConfigProps {
  agentId: string;
  agentName: string;
  schedules: AgentSchedule[];
  onClose: () => void;
}

export function AgentScheduleConfig({
  agentId,
  agentName,
  schedules: initialSchedules,
  onClose,
}: AgentScheduleConfigProps) {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      const schedule = await createAgentSchedule({
        agent_id: agentId,
        name: `schedule-${Date.now()}`,
        prompt: "",
        cron_expression: "0 9 * * *",
      });
      setSchedules((prev) => [...prev, schedule]);
    });
  }

  // Debounce timers for text inputs to avoid server action on every keystroke
  const debounceTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const debouncedUpdate = useCallback(
    (id: string, data: Partial<AgentSchedule>) => {
      const key = `${id}-${Object.keys(data).join(",")}`;
      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);

      // Update local state immediately for responsiveness
      setSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...data } : s))
      );

      debounceTimers.current.set(
        key,
        setTimeout(() => {
          startTransition(async () => {
            await updateAgentSchedule(id, data);
          });
          debounceTimers.current.delete(key);
        }, 600)
      );
    },
    [startTransition]
  );

  function handleUpdate(id: string, data: Partial<AgentSchedule>) {
    startTransition(async () => {
      const updated = await updateAgentSchedule(id, data);
      setSchedules((prev) => prev.map((s) => (s.id === id ? updated : s)));
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteAgentSchedule(id);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Schedules — {agentName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="rounded border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={schedule.name}
                  onChange={(e) =>
                    debouncedUpdate(schedule.id, { name: e.target.value })
                  }
                  className="text-sm font-medium border-b border-transparent focus:border-blue-500 outline-none"
                  placeholder="Schedule name"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdate(schedule.id, {
                        is_active: !schedule.is_active,
                      })
                    }
                    className={`rounded px-2 py-1 text-xs ${
                      schedule.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {schedule.is_active ? "Active" : "Inactive"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(schedule.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <textarea
                value={schedule.prompt}
                onChange={(e) =>
                  debouncedUpdate(schedule.id, { prompt: e.target.value })
                }
                rows={2}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="Prompt to send the agent..."
              />

              <div className="flex items-center gap-2">
                <select
                  value={
                    CRON_PRESETS.find(
                      (p) => p.value === schedule.cron_expression
                    )
                      ? schedule.cron_expression
                      : ""
                  }
                  onChange={(e) => {
                    if (e.target.value) {
                      handleUpdate(schedule.id, {
                        cron_expression: e.target.value,
                      });
                    }
                  }}
                  className="rounded border px-2 py-1 text-sm"
                >
                  {CRON_PRESETS.map((preset) => (
                    <option key={preset.label} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={schedule.cron_expression}
                  onChange={(e) =>
                    debouncedUpdate(schedule.id, {
                      cron_expression: e.target.value,
                    })
                  }
                  className="rounded border px-2 py-1 text-sm font-mono flex-1"
                  placeholder="*/5 * * * *"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleAdd}
          disabled={isPending}
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add Schedule
        </button>
      </div>
    </div>
  );
}
