"use client";

import { useState, useTransition } from "react";
import {
  checkForUpdates,
  applyMigrations,
  applySeedUpdates,
  markCodeRedeployed,
  finalizeUpdate,
} from "@/actions/updates";
import type { UpdateCheckResult, UpdateHistoryEntry } from "@/actions/updates";
import { UpdateCard } from "./update-card";
import { UpdateStepper } from "./update-stepper";

interface UpdateManagerProps {
  currentVersion: string;
  lastMigrationNumber: number;
  updateHistory: UpdateHistoryEntry[];
}

export function UpdateManager({
  currentVersion,
  lastMigrationNumber,
  updateHistory,
}: UpdateManagerProps) {
  const [checkResult, setCheckResult] = useState<UpdateCheckResult | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCheck() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await checkForUpdates();
        setCheckResult(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to check for updates"
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Current Version */}
      <section className="rounded-lg border bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Current Version
            </h2>
            <div className="mt-2 flex items-center gap-4">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                v{currentVersion}
              </span>
              <span className="text-sm text-gray-500">
                Migration level: {lastMigrationNumber}
              </span>
            </div>
          </div>
          <button
            onClick={handleCheck}
            disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Checking..." : "Check for Updates"}
          </button>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Check Results */}
      {checkResult && !checkResult.hasUpdate && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          You&apos;re up to date! Running the latest version (v
          {checkResult.currentVersion}).
        </div>
      )}

      {checkResult && checkResult.hasUpdate && (
        <>
          {/* Breaking change warning */}
          {checkResult.hasBreaking && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <strong>Warning:</strong> One or more updates contain breaking
              changes. Review the release notes carefully before applying.
            </div>
          )}

          {/* Available releases */}
          <section className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Available Updates
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {checkResult.releases.length} new release
              {checkResult.releases.length !== 1 ? "s" : ""} available
            </p>
            <div className="mt-4 space-y-3">
              {checkResult.releases.map((release) => (
                <UpdateCard key={release.tag} release={release} />
              ))}
            </div>
          </section>

          {/* Apply Update Stepper */}
          <UpdateStepper
            checkResult={checkResult}
            onApplyMigrations={applyMigrations}
            onApplySeedUpdates={applySeedUpdates}
            onMarkRedeployed={markCodeRedeployed}
            onFinalize={finalizeUpdate}
          />
        </>
      )}

      {/* Update History */}
      {updateHistory.length > 0 && (
        <section className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Update History
          </h2>
          <div className="mt-4 space-y-2">
            {[...updateHistory].reverse().map((entry, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border px-4 py-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      entry.status === "success"
                        ? "bg-green-500"
                        : entry.status === "partial"
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                  />
                  <span className="font-medium text-gray-900">
                    {entry.version}
                  </span>
                  {entry.migrations_run > 0 && (
                    <span className="text-gray-500">
                      {entry.migrations_run} migration
                      {entry.migrations_run !== 1 ? "s" : ""}
                    </span>
                  )}
                  {entry.seed_updates.length > 0 && (
                    <span className="text-gray-500">
                      seed: {entry.seed_updates.join(", ")}
                    </span>
                  )}
                </div>
                <span className="text-gray-400">
                  {new Date(entry.applied_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
