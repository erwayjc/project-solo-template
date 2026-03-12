import { getSkill } from "@/actions/agents";
import { SkillEditor } from "@/components/admin/skill-editor";
import Link from "next/link";

export default async function EditSkillPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const skill = await getSkill(slug);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/skills"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Skills
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Edit: {skill.name}
        </h1>
      </div>
      <SkillEditor skill={skill} />
    </div>
  );
}
