"use client";

import { useState, useTransition } from "react";
import type { UpdateCheckResult } from "@/actions/updates";

type StepStatus = "pending" | "in_progress" | "done" | "error" | "skipped";

interface UpdateStepperProps {
  checkResult: UpdateCheckResult;
  onApplyMigrations: () => Promise<{
    success: boolean;
    migrationsRun: number;
    error?: string;
  }>;
  onApplySeedUpdates: (
    tables: string[]
  ) => Promise<{
    success: boolean;
    tablesUpdated: string[];
    error?: string;
  }>;
  onMarkRedeployed: () => Promise<{
    success: boolean;
    newVersion?: string;
    newMigrationCount?: number;
    error?: string;
  }>;
  onFinalize: (version: string) => Promise<{ success: boolean }>;
}

export function UpdateStepper({
  checkResult,
  onApplyMigrations,
  onApplySeedUpdates,
  onMarkRedeployed,
  onFinalize,
}: UpdateStepperProps) {
  const [step1Status, setStep1Status] = useState<StepStatus>("pending");
  const [step2Status, setStep2Status] = useState<StepStatus>("pending");
  const [step3Status, setStep3Status] = useState<StepStatus>("pending");
  const [step4Status, setStep4Status] = useState<StepStatus>("pending");
  const [stepError, setStepError] = useState<string | null>(null);
  const [migrationsRun, setMigrationsRun] = useState(0);
  const [selectedSeedTables, setSelectedSeedTables] = useState<string[]>(
    checkResult.seedUpdates
  );
  const [isPending, startTransition] = useTransition();

  const hasMigrations = checkResult.pendingMigrationCount > 0;
  const hasSeedUpdates = checkResult.seedUpdates.length > 0;

  function handleMarkRedeployed() {
    setStepError(null);
    startTransition(async () => {
      setStep1Status("in_progress");
      try {
        const result = await onMarkRedeployed();
        if (result.success) {
          setStep1Status("done");
        } else {
          setStep1Status("error");
          setStepError(result.error || "Verification failed");
        }
      } catch (err) {
        setStep1Status("error");
        setStepError(
          err instanceof Error ? err.message : "Verification failed"
        );
      }
    });
  }

  function handleApplyMigrations() {
    setStepError(null);
    startTransition(async () => {
      setStep2Status("in_progress");
      try {
        const result = await onApplyMigrations();
        if (result.success) {
          setStep2Status("done");
          setMigrationsRun(result.migrationsRun);
        } else {
          setStep2Status("error");
          setStepError(result.error || "Migration failed");
        }
      } catch (err) {
        setStep2Status("error");
        setStepError(
          err instanceof Error ? err.message : "Migration failed"
        );
      }
    });
  }

  function handleSkipMigrations() {
    setStep2Status("skipped");
  }

  function handleApplySeedUpdates() {
    setStepError(null);
    startTransition(async () => {
      setStep3Status("in_progress");
      try {
        const result = await onApplySeedUpdates(selectedSeedTables);
        if (result.success) {
          setStep3Status("done");
        } else {
          setStep3Status("error");
          setStepError(result.error || "Seed update failed");
        }
      } catch (err) {
        setStep3Status("error");
        setStepError(
          err instanceof Error ? err.message : "Seed update failed"
        );
      }
    });
  }

  function handleSkipSeedUpdates() {
    setStep3Status("skipped");
  }

  function handleFinalize() {
    setStepError(null);
    startTransition(async () => {
      setStep4Status("in_progress");
      try {
        await onFinalize(checkResult.latestVersion);
        setStep4Status("done");
      } catch (err) {
        setStep4Status("error");
        setStepError(
          err instanceof Error ? err.message : "Finalization failed"
        );
      }
    });
  }

  function toggleSeedTable(table: string) {
    setSelectedSeedTables((prev) =>
      prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table]
    );
  }

  return (
    <section className="rounded-lg border bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Apply Update</h2>
      <p className="mt-1 text-sm text-gray-500">
        Follow these steps to update to v{checkResult.latestVersion}.
      </p>

      {/* Warning */}
      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Back up your database before proceeding. You can create a backup from
        your Supabase dashboard.
      </div>

      {stepError && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {stepError}
        </div>
      )}

      <div className="mt-6 space-y-6">
        {/* Step 1: Redeploy Code */}
        <StepSection
          number={1}
          title="Redeploy Code"
          description="Deploy the latest template code to your Railway project."
          status={step1Status}
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Go to your Railway dashboard and redeploy your web service from the
              latest commit. Then click the button below to verify.
            </p>
            <div className="flex gap-3">
              <a
                href="https://railway.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Open Railway Dashboard
              </a>
              {step1Status !== "done" && (
                <button
                  onClick={handleMarkRedeployed}
                  disabled={isPending}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending && step1Status === "in_progress"
                    ? "Verifying..."
                    : "I've Redeployed"}
                </button>
              )}
            </div>
          </div>
        </StepSection>

        {/* Step 2: Run Migrations */}
        <StepSection
          number={2}
          title="Run Migrations"
          description={
            hasMigrations
              ? `${checkResult.pendingMigrationCount} new migration${checkResult.pendingMigrationCount !== 1 ? "s" : ""} to apply.`
              : "No new migrations in this update."
          }
          status={!hasMigrations ? "skipped" : step2Status}
        >
          {hasMigrations && step1Status === "done" && step2Status !== "done" && step2Status !== "skipped" && (
            <div className="flex gap-3">
              <button
                onClick={handleApplyMigrations}
                disabled={isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending && step2Status === "in_progress"
                  ? "Applying..."
                  : `Apply ${checkResult.pendingMigrationCount} Migration${checkResult.pendingMigrationCount !== 1 ? "s" : ""}`}
              </button>
              <button
                onClick={handleSkipMigrations}
                className="rounded-md border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Skip
              </button>
            </div>
          )}
          {step2Status === "done" && (
            <p className="text-sm text-green-600">
              Successfully applied {migrationsRun} migration
              {migrationsRun !== 1 ? "s" : ""}.
            </p>
          )}
          {hasMigrations && step1Status !== "done" && step2Status === "pending" && (
            <p className="text-sm text-gray-400">
              Complete Step 1 first.
            </p>
          )}
        </StepSection>

        {/* Step 3: Update Seed Data */}
        <StepSection
          number={3}
          title="Update Seed Data"
          description={
            hasSeedUpdates
              ? "Update system-managed records (your custom data is safe)."
              : "No seed data updates in this release."
          }
          status={!hasSeedUpdates ? "skipped" : step3Status}
        >
          {hasSeedUpdates &&
            (step2Status === "done" || step2Status === "skipped" || !hasMigrations) &&
            step1Status === "done" &&
            step3Status !== "done" &&
            step3Status !== "skipped" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {checkResult.seedUpdates.map((table) => (
                    <label
                      key={table}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSeedTables.includes(table)}
                        onChange={() => toggleSeedTable(table)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-700">{table}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  Only system-managed records are updated. Your custom agents and
                  connections are preserved.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleApplySeedUpdates}
                    disabled={isPending || selectedSeedTables.length === 0}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isPending && step3Status === "in_progress"
                      ? "Updating..."
                      : "Update Selected"}
                  </button>
                  <button
                    onClick={handleSkipSeedUpdates}
                    className="rounded-md border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}
        </StepSection>

        {/* Step 4: Verify & Finalize */}
        <StepSection
          number={4}
          title="Verify & Finalize"
          description="Run a health check and finalize the update."
          status={step4Status}
        >
          {step1Status === "done" &&
            (step2Status === "done" || step2Status === "skipped" || !hasMigrations) &&
            (step3Status === "done" || step3Status === "skipped" || !hasSeedUpdates) &&
            step4Status !== "done" && (
              <div className="flex gap-3">
                <a
                  href="/api/health"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Run Health Check
                </a>
                <button
                  onClick={handleFinalize}
                  disabled={isPending}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isPending && step4Status === "in_progress"
                    ? "Finalizing..."
                    : `Finalize Update to v${checkResult.latestVersion}`}
                </button>
              </div>
            )}
          {step4Status === "done" && (
            <p className="text-sm text-green-600">
              Update complete! You&apos;re now running v
              {checkResult.latestVersion}.
            </p>
          )}
        </StepSection>
      </div>
    </section>
  );
}

// ── Step Section Component ──

function StepSection({
  number,
  title,
  description,
  status,
  children,
}: {
  number: number;
  title: string;
  description: string;
  status: StepStatus;
  children?: React.ReactNode;
}) {
  const statusColors: Record<StepStatus, string> = {
    pending: "border-gray-300 bg-gray-100 text-gray-500",
    in_progress: "border-blue-500 bg-blue-100 text-blue-700",
    done: "border-green-500 bg-green-100 text-green-700",
    error: "border-red-500 bg-red-100 text-red-700",
    skipped: "border-gray-300 bg-gray-50 text-gray-400",
  };

  const statusLabels: Record<StepStatus, string> = {
    pending: "",
    in_progress: "In progress",
    done: "Done",
    error: "Error",
    skipped: "Skipped",
  };

  return (
    <div className={`rounded-md border p-4 ${status === "skipped" ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium ${statusColors[status]}`}
        >
          {status === "done" ? "\u2713" : number}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{title}</h3>
            {statusLabels[status] && (
              <span
                className={`text-xs font-medium ${
                  status === "done"
                    ? "text-green-600"
                    : status === "error"
                      ? "text-red-600"
                      : status === "in_progress"
                        ? "text-blue-600"
                        : "text-gray-400"
                }`}
              >
                {statusLabels[status]}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{description}</p>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}
