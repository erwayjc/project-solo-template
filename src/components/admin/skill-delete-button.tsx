"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteSkill } from "@/actions/agents";

export function SkillDeleteButton({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete skill "${name}"? This cannot be undone.`)) return;

    setPending(true);
    try {
      await deleteSkill(slug);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete skill");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
    >
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}
