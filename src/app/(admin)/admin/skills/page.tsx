import Link from "next/link";
import { getInstalledSkills } from "@/actions/agents";
import { SkillDeleteButton } from "@/components/admin/skill-delete-button";

export default async function SkillsPage() {
  const skills = await getInstalledSkills();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skills</h1>
          <p className="mt-1 text-sm text-gray-500">
            Modular knowledge packages that enhance agent capabilities.
          </p>
        </div>
        <Link
          href="/admin/skills/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New Skill
        </Link>
      </div>

      {skills.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm text-gray-500">
            No skills installed. Click &quot;New Skill&quot; to create one, or
            add a{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
              skills/your-skill/SKILL.md
            </code>{" "}
            file manually.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <div
              key={skill.slug}
              className="group relative rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <h3 className="font-semibold text-gray-900">{skill.name}</h3>
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {skill.invocation}
                </span>
              </div>

              <p className="mb-3 text-sm text-gray-600 line-clamp-2">
                {skill.description}
              </p>

              {/* Agents */}
              <div className="mb-2 flex flex-wrap gap-1">
                {skill.agents.map((agent) => (
                  <span
                    key={agent}
                    className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {agent}
                  </span>
                ))}
              </div>

              {/* Tags */}
              {skill.tags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {skill.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* References count */}
              {skill.referenceCount > 0 && (
                <p className="mb-3 text-xs text-gray-400">
                  {skill.referenceCount} reference
                  {skill.referenceCount !== 1 ? "s" : ""} available
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 border-t pt-3">
                <Link
                  href={`/admin/skills/${skill.slug}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Edit
                </Link>
                <SkillDeleteButton slug={skill.slug} name={skill.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
