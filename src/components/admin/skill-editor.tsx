"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveSkill } from "@/actions/agents";
import type { SkillDetail } from "@/actions/agents";

interface SkillEditorProps {
  skill?: SkillDetail;
  isNew?: boolean;
}

export function SkillEditor({ skill, isNew }: SkillEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [slug, setSlug] = useState(skill?.slug ?? "");
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [agentsStr, setAgentsStr] = useState(
    skill?.agents.join(", ") ?? "dev-agent"
  );
  const [tagsStr, setTagsStr] = useState(skill?.tags.join(", ") ?? "");
  const [invocation, setInvocation] = useState<"user" | "model" | "both">(
    skill?.invocation ?? "both"
  );
  const [body, setBody] = useState(skill?.body ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const agents = agentsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const tags = tagsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await saveSkill({
        slug,
        name,
        description,
        agents,
        tags,
        invocation,
        body,
      });

      router.push("/admin/skills");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save skill");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Slug */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Slug
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={!isNew}
            placeholder="my-skill"
            pattern="[a-z0-9-]+"
            required
            className="w-full rounded-md border px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            Lowercase letters, numbers, hyphens only
          </p>
        </div>

        {/* Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Skill"
            required
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe when this skill should be activated..."
          rows={2}
          required
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">
          Used for relevance matching — describe when agents should use this
          skill
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {/* Agents */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Agents
          </label>
          <input
            type="text"
            value={agentsStr}
            onChange={(e) => setAgentsStr(e.target.value)}
            placeholder="dev-agent, content-director"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-400">
            Comma-separated slugs, or * for all agents
          </p>
        </div>

        {/* Tags */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Tags
          </label>
          <input
            type="text"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            placeholder="seo, content, marketing"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-400">
            Comma-separated tags for categorization
          </p>
        </div>

        {/* Invocation */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Invocation
          </label>
          <select
            value={invocation}
            onChange={(e) =>
              setInvocation(e.target.value as "user" | "model" | "both")
            }
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="both">Both (user + model)</option>
            <option value="user">User only</option>
            <option value="model">Model only</option>
          </select>
        </div>
      </div>

      {/* Body */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Skill Body (Markdown)
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="## Playbook&#10;&#10;Instructions for the agent when this skill is active..."
          rows={16}
          className="w-full rounded-md border px-3 py-2 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">
          This content is injected into the agent&apos;s context when the skill
          is activated
        </p>
      </div>

      {/* Reference files (read-only display for existing skills) */}
      {skill && skill.referenceFiles.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Reference Files
          </label>
          <div className="flex flex-wrap gap-2">
            {skill.referenceFiles.map((ref) => (
              <span
                key={ref}
                className="rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-600"
              >
                {ref}.md
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Manage reference files directly in the{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5">
              skills/{skill.slug}/references/
            </code>{" "}
            directory
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 border-t pt-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : isNew ? "Create Skill" : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/skills")}
          className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
