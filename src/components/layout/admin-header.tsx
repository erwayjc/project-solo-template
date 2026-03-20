"use client";

import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Kbd } from "@/components/ui/kbd";

export function AdminHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <Breadcrumbs />
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            document.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true }),
            );
          }}
          className="hidden items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-500 sm:flex"
        >
          Search...
          <Kbd>⌘K</Kbd>
        </button>
        <Link
          href="/"
          className="text-sm text-gray-400 transition-colors hover:text-gray-600"
          target="_blank"
        >
          View Site
        </Link>
      </div>
    </header>
  );
}
