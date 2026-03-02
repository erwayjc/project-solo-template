import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Course Editor - Admin" };

export default async function CourseEditorPage() {
  const supabase = await createClient();
  const { data: modules } = await supabase
    .from("modules")
    .select("*, lessons(*)")
    .order("sort_order");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Course Editor</h1>
      </div>
      <div className="mt-6 space-y-6">
        {modules?.map((mod) => {
          const lessons = (mod.lessons as { id: string; title: string; sort_order: number; is_published: boolean }[])
            ?.sort((a, b) => a.sort_order - b.sort_order) || [];
          return (
            <div key={mod.id} className="rounded-lg border bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {mod.title}
                  </h2>
                  <p className="text-sm text-gray-500">{mod.description}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    mod.is_published
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {mod.is_published ? "Published" : "Draft"}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {lessons.map((lesson, index) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between rounded-md bg-gray-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {lesson.title}
                      </span>
                    </div>
                    <span
                      className={`text-xs ${
                        lesson.is_published
                          ? "text-green-600"
                          : "text-gray-400"
                      }`}
                    >
                      {lesson.is_published ? "Published" : "Draft"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
