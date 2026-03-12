"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import {
  createAgentTrigger,
  updateAgentTrigger,
  deleteAgentTrigger,
} from "@/actions/agent-schedules";
import type { AgentTrigger } from "@/types/database";

const TABLE_OPTIONS = [
  "leads",
  "support_tickets",
  "purchases",
  "blog_posts",
  "content_queue",
];

const EVENT_OPTIONS = ["INSERT", "UPDATE", "DELETE"];

interface AgentTriggerConfigProps {
  agentId: string;
  agentName: string;
  triggers: AgentTrigger[];
  onClose: () => void;
}

export function AgentTriggerConfig({
  agentId,
  agentName,
  triggers: initialTriggers,
  onClose,
}: AgentTriggerConfigProps) {
  const [triggers, setTriggers] = useState(initialTriggers);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      const trigger = await createAgentTrigger({
        agent_id: agentId,
        name: `trigger-${Date.now()}`,
        table_name: "leads",
        prompt_template: "A new record was created: {{record}}",
      });
      setTriggers((prev) => [...prev, trigger]);
    });
  }

  // Debounce timers for text inputs to avoid server action on every keystroke
  const debounceTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const debouncedUpdate = useCallback(
    (id: string, data: Partial<AgentTrigger>) => {
      const key = `${id}-${Object.keys(data).join(",")}`;
      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);

      // Update local state immediately for responsiveness
      setTriggers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...data } : t))
      );

      debounceTimers.current.set(
        key,
        setTimeout(() => {
          startTransition(async () => {
            await updateAgentTrigger(id, data);
          });
          debounceTimers.current.delete(key);
        }, 600)
      );
    },
    [startTransition]
  );

  function handleUpdate(id: string, data: Partial<AgentTrigger>) {
    startTransition(async () => {
      const updated = await updateAgentTrigger(id, data);
      setTriggers((prev) => prev.map((t) => (t.id === id ? updated : t)));
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteAgentTrigger(id);
      setTriggers((prev) => prev.filter((t) => t.id !== id));
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Triggers — {agentName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4">
          {triggers.map((trigger) => (
            <div key={trigger.id} className="rounded border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={trigger.name}
                  onChange={(e) =>
                    debouncedUpdate(trigger.id, { name: e.target.value })
                  }
                  className="text-sm font-medium border-b border-transparent focus:border-blue-500 outline-none"
                  placeholder="Trigger name"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdate(trigger.id, {
                        is_active: !trigger.is_active,
                      })
                    }
                    className={`rounded px-2 py-1 text-xs ${
                      trigger.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {trigger.is_active ? "Active" : "Inactive"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(trigger.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={trigger.table_name}
                  onChange={(e) =>
                    handleUpdate(trigger.id, {
                      table_name: e.target.value,
                    } as Partial<AgentTrigger>)
                  }
                  className="rounded border px-2 py-1 text-sm"
                >
                  {TABLE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select
                  value={trigger.event_type}
                  onChange={(e) =>
                    handleUpdate(trigger.id, {
                      event_type: e.target.value,
                    } as Partial<AgentTrigger>)
                  }
                  className="rounded border px-2 py-1 text-sm"
                >
                  {EVENT_OPTIONS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                value={trigger.prompt_template}
                onChange={(e) =>
                  debouncedUpdate(trigger.id, {
                    prompt_template: e.target.value,
                  })
                }
                rows={2}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder='Use {{record}} for the event data...'
              />

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Cooldown (s):</label>
                <input
                  type="number"
                  value={trigger.cooldown_seconds}
                  onChange={(e) =>
                    handleUpdate(trigger.id, {
                      cooldown_seconds: parseInt(e.target.value, 10) || 60,
                    })
                  }
                  className="w-20 rounded border px-2 py-1 text-sm"
                  min={0}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleAdd}
          disabled={isPending}
          className="mt-4 rounded bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
        >
          Add Trigger
        </button>
      </div>
    </div>
  );
}
