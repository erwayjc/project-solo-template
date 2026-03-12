"use client";

import { useState, useEffect, useTransition } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { activateGoal, pauseGoal } from "@/actions/agent-schedules";
import type { Goal, GoalTask } from "@/types/database";

interface GoalTrackerProps {
  initialGoals: Goal[];
  initialTasks: GoalTask[];
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
};

export function GoalTracker({ initialGoals, initialTasks }: GoalTrackerProps) {
  const { data: goals } = useRealtime<Goal & Record<string, unknown>>({
    table: "goals",
    initialData: initialGoals as (Goal & Record<string, unknown>)[],
  });
  const { data: tasks } = useRealtime<GoalTask & Record<string, unknown>>({
    table: "goal_tasks",
    initialData: initialTasks as (GoalTask & Record<string, unknown>)[],
  });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Sort: active first, then by created_at desc
  const sorted = [...goals].sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (b.status === "active" && a.status !== "active") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (sorted.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-gray-400">
        No goals yet. Set one below!
      </div>
    );
  }

  function handleToggle(goal: Goal & Record<string, unknown>) {
    startTransition(async () => {
      if (goal.status === "active") {
        await pauseGoal(goal.id as string);
      } else {
        await activateGoal(goal.id as string);
      }
    });
  }

  return (
    <div className="space-y-3">
      {sorted.map((goal) => {
        const goalTasks = tasks.filter(
          (t) => t.goal_id === goal.id
        );
        const completed = goalTasks.filter(
          (t) => t.status === "completed"
        ).length;
        const total = goalTasks.length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        const isOpen = expanded === (goal.id as string);
        const daysLeft = goal.target_date
          ? Math.ceil(
              (new Date(goal.target_date as string).getTime() - now) /
                (1000 * 60 * 60 * 24)
            )
          : null;

        return (
          <div key={goal.id as string} className="rounded-lg border bg-white">
            <div
              className="flex items-start gap-3 px-4 py-3 cursor-pointer"
              onClick={() =>
                setExpanded(isOpen ? null : (goal.id as string))
              }
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {goal.title as string}
                  </h4>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      statusColors[goal.status as string] ?? statusColors.draft
                    }`}
                  >
                    {goal.status as string}
                  </span>
                </div>

                {/* Progress bar */}
                {total > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">
                      {completed}/{total}
                    </span>
                  </div>
                )}

                <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                  {daysLeft !== null && (
                    <span>
                      {daysLeft > 0
                        ? `${daysLeft} days left`
                        : daysLeft === 0
                          ? "Due today"
                          : `${Math.abs(daysLeft)} days overdue`}
                    </span>
                  )}
                </div>
              </div>

              {(goal.status === "active" || goal.status === "paused") && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(goal);
                  }}
                  disabled={isPending}
                  className="rounded px-2 py-1 text-xs border hover:bg-gray-50 disabled:opacity-50"
                >
                  {goal.status === "active" ? "Pause" : "Resume"}
                </button>
              )}
            </div>

            {isOpen && goalTasks.length > 0 && (
              <div className="border-t px-4 py-3 space-y-1">
                {goalTasks
                  .sort(
                    (a, b) =>
                      ((a.order_index as number) ?? 0) -
                      ((b.order_index as number) ?? 0)
                  )
                  .map((task) => (
                    <div
                      key={task.id as string}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          task.status === "completed"
                            ? "bg-green-500"
                            : task.status === "failed"
                              ? "bg-red-500"
                              : task.status === "running"
                                ? "bg-blue-500 animate-pulse"
                                : "bg-gray-300"
                        }`}
                      />
                      <span
                        className={
                          task.status === "completed"
                            ? "text-gray-400 line-through"
                            : "text-gray-700"
                        }
                      >
                        {task.title as string}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
