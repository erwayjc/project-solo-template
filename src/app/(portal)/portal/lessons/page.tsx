import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Lessons" };

export default async function LessonsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: modules } = await supabase
    .from("modules")
    .select("*, lessons(*)")
    .eq("is_published", true)
    .order("sort_order");

  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed")
    .eq("user_id", user!.id);

  const completedIds = new Set(
    progress?.filter((p) => p.completed).map((p) => p.lesson_id) || []
  );

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Course Lessons</h1>
      <div className="mt-8 space-y-6">
        {modules?.map((mod) => {
          const lessons = (mod.lessons as { id: string; title: string; sort_order: number; is_published: boolean }[])
            ?.filter((l) => l.is_published)
            ?.sort((a, b) => a.sort_order - b.sort_order) || [];
          const completed = lessons.filter((l) => completedIds.has(l.id)).length;

          return (
            <div key={mod.id} className="rounded-lg border bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {mod.title}
                </h2>
                <span className="text-sm text-gray-500">
                  {completed}/{lessons.length} complete
                </span>
              </div>
              {mod.description && (
                <p className="mt-1 text-sm text-gray-600">{mod.description}</p>
              )}
              <div className="mt-4 space-y-2">
                {lessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/portal/lessons/${lesson.id}`}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        completedIds.has(lesson.id)
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {completedIds.has(lesson.id) ? "\u2713" : "\u00B7"}
                    </span>
                    {lesson.title}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
