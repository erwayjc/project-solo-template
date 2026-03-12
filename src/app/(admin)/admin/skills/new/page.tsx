import { SkillEditor } from "@/components/admin/skill-editor";
import Link from "next/link";

export default function NewSkillPage() {
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
          Create New Skill
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Define a new knowledge package for your agents.
        </p>
      </div>
      <SkillEditor isNew />
    </div>
  );
}
