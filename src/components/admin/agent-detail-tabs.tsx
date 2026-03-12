"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatContainer } from "@/components/agent/chat-container";
import { AgentScheduleConfig } from "@/components/admin/agent-schedule-config";
import { AgentTriggerConfig } from "@/components/admin/agent-trigger-config";
import { updateAgent, getAvailableModels } from "@/actions/agents";
import type {
  Agent,
  AgentSchedule,
  AgentTrigger,
  AgentRun,
} from "@/types/database";

const TABS = [
  { key: "chat", label: "Chat" },
  { key: "config", label: "Config" },
  { key: "runs", label: "Runs" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface AgentDetailTabsProps {
  agent: Agent;
  schedules: AgentSchedule[];
  triggers: AgentTrigger[];
  runs: AgentRun[];
  initialTab: TabKey;
}

export function AgentDetailTabs({
  agent,
  schedules,
  triggers,
  runs,
  initialTab,
}: AgentDetailTabsProps) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const router = useRouter();

  function switchTab(t: TabKey) {
    setTab(t);
    router.replace(`/admin/agents/${agent.id}?tab=${t}`, { scroll: false });
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{agent.icon}</span>
          <h1 className="text-xl font-semibold text-gray-900">{agent.name}</h1>
          {agent.is_system && (
            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
              System
            </span>
          )}
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === "chat" && <ChatContainer agentId={agent.id} />}
        {tab === "config" && (
          <ConfigTab
            agent={agent}
            schedules={schedules}
            triggers={triggers}
          />
        )}
        {tab === "runs" && <RunsTab runs={runs} />}
      </div>
    </div>
  );
}

/* ─── Config Tab ─── */

function ConfigTab({
  agent,
  schedules,
  triggers,
}: {
  agent: Agent;
  schedules: AgentSchedule[];
  triggers: AgentTrigger[];
}) {
  const [isPending, startTransition] = useTransition();
  const [showSchedules, setShowSchedules] = useState(false);
  const [showTriggers, setShowTriggers] = useState(false);
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || "");
  const [model, setModel] = useState(agent.model || "claude-sonnet-4-20250514");
  const [models, setModels] = useState<{ id: string; display_name: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt || "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAvailableModels()
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setModelsLoading(false));
  }, []);

  function handleSave() {
    if (!name.trim()) return;

    startTransition(async () => {
      await updateAgent(agent.id, {
        name: name.trim(),
        description: description.trim(),
        model,
        system_prompt: systemPrompt.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Model
          </label>
          {modelsLoading ? (
            <div className="mt-1 w-full rounded-md border px-3 py-2 text-sm text-gray-400">
              Loading models...
            </div>
          ) : (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
              {models.length === 0 && (
                <option value={model}>{model}</option>
              )}
            </select>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Controls cost and capability. Fetched live from Anthropic.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            System Prompt
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={8}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm font-mono"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isPending || !name.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </button>
          {saved && (
            <span className="text-sm text-green-600">Saved</span>
          )}
        </div>

        <hr />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Automation</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSchedules(true)}
              className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Schedules ({schedules.length})
            </button>
            <button
              onClick={() => setShowTriggers(true)}
              className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Triggers ({triggers.length})
            </button>
          </div>
        </div>
      </div>

      {showSchedules && (
        <AgentScheduleConfig
          agentId={agent.id}
          agentName={agent.name}
          schedules={schedules}
          onClose={() => setShowSchedules(false)}
        />
      )}
      {showTriggers && (
        <AgentTriggerConfig
          agentId={agent.id}
          agentName={agent.name}
          triggers={triggers}
          onClose={() => setShowTriggers(false)}
        />
      )}
    </div>
  );
}

/* ─── Runs Tab ─── */

function RunsTab({ runs }: { runs: AgentRun[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

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

  if (runs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        No runs yet. Activate a schedule or trigger to see runs here.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white text-left text-xs text-gray-500">
          <tr className="border-b">
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Trigger</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Duration</th>
            <th className="px-4 py-3 font-medium">Tokens</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
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
              <tr
                key={run.id}
                className="cursor-pointer border-b hover:bg-gray-50"
                onClick={() => setExpanded(isOpen ? null : run.id)}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  {new Date(run.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      triggerColors[run.trigger_type] ?? triggerColors.manual
                    }`}
                  >
                    {run.trigger_type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      statusColors[run.status] ?? statusColors.pending
                    }`}
                  >
                    {run.status}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {duration !== null ? `${duration}s` : "—"}
                </td>
                <td className="px-4 py-3">
                  {run.tokens_used ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
