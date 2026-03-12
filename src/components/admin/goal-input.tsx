"use client";

import { useState, useTransition } from "react";
import { createGoal, activateGoal } from "@/actions/agent-schedules";

interface GoalInputProps {
  onGoalCreated?: (goalId: string) => void;
}

export function GoalInput({ onGoalCreated }: GoalInputProps) {
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [confirmMode, setConfirmMode] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    // Show confirmation before activating
    if (!confirmMode) {
      setConfirmMode(true);
      return;
    }

    startTransition(async () => {
      const goal = await createGoal({
        title: title.trim(),
        target_date: targetDate || undefined,
      });
      await activateGoal(goal.id);
      setTitle("");
      setTargetDate("");
      setConfirmMode(false);
      onGoalCreated?.(goal.id);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-4">
      <textarea
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setConfirmMode(false);
        }}
        rows={2}
        className="w-full rounded-md border px-3 py-2 text-sm resize-none"
        placeholder="What do you want to achieve? e.g., 'Grow my newsletter to 1,000 subscribers in 90 days'"
      />
      <div className="mt-2 flex items-center gap-3">
        <input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="rounded border px-2 py-1 text-sm text-gray-600"
        />
        {confirmMode && (
          <button
            type="button"
            onClick={() => setConfirmMode(false)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending || !title.trim()}
          className={`ml-auto rounded px-4 py-1.5 text-sm text-white disabled:opacity-50 ${
            confirmMode
              ? "bg-green-600 hover:bg-green-700"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isPending
            ? "Setting..."
            : confirmMode
              ? "Confirm & Activate"
              : "Set Goal"}
        </button>
      </div>
    </form>
  );
}
