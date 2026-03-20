"use client";

import { useState } from "react";
import type { TemplateRelease } from "@/lib/updates/github";
import { getReleaseNotes } from "@/lib/updates/github";

interface UpdateCardProps {
  release: TemplateRelease;
}

export function UpdateCard({ release }: UpdateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const notes = getReleaseNotes(release.body);

  return (
    <div className="rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium text-gray-900">v{release.version}</span>
          <span className="text-sm text-gray-400">
            {new Date(release.published_at).toLocaleDateString()}
          </span>

          {/* Badges */}
          <div className="flex gap-1.5">
            {release.metadata.migration_range && (
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                migrations
              </span>
            )}
            {release.metadata.seed_updates &&
              release.metadata.seed_updates.length > 0 && (
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                  seed data
                </span>
              )}
            {release.metadata.breaking && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                breaking
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {expanded ? "Hide" : "Details"}
        </button>
      </div>

      {expanded && notes && (
        <div className="mt-3 border-t pt-3 text-sm text-gray-600 whitespace-pre-wrap">
          {notes}
        </div>
      )}
    </div>
  );
}
