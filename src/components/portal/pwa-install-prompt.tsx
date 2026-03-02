"use client";

import { useState, useEffect } from "react";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { cn } from "@/lib/utils/cn";

const DISMISSED_KEY = "pwa-install-prompt-dismissed";

interface PwaInstallPromptProps {
  className?: string;
}

export function PwaInstallPrompt({ className }: PwaInstallPromptProps) {
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();
  const [isDismissed, setIsDismissed] = useState(true);

  // Read dismissed state from localStorage on mount
  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    setIsDismissed(dismissed === "true");
  }, []);

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setIsDismissed(true);
  }

  async function handleInstall() {
    const accepted = await promptInstall();
    if (accepted) {
      handleDismiss();
    }
  }

  // Don't render if not installable, already installed, or dismissed
  if (!isInstallable || isInstalled || isDismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <svg
          className="h-5 w-5 shrink-0 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        <p className="text-sm text-blue-800">
          Install this app for a better experience with offline access.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleInstall}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          Install
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-100"
          aria-label="Dismiss install prompt"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
