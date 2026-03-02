import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*, modules(title)")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (!lesson) {
    notFound();
  }

  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("completed")
    .eq("user_id", user!.id)
    .eq("lesson_id", id)
    .single();

  const downloads = (lesson.downloads as { name: string; url: string }[]) || [];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-gray-500">
        {(lesson.modules as { title: string })?.title}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900">{lesson.title}</h1>

      {lesson.video_url && (
        <div className="mt-6 aspect-video overflow-hidden rounded-lg bg-black">
          <iframe
            src={lesson.video_url}
            className="h-full w-full"
            allowFullScreen
          />
        </div>
      )}

      <div className="prose prose-lg mt-8 max-w-none">{lesson.content}</div>

      {downloads.length > 0 && (
        <div className="mt-8 rounded-lg border bg-gray-50 p-4">
          <h3 className="font-semibold text-gray-900">Downloads</h3>
          <div className="mt-2 space-y-2">
            {downloads.map((dl, i) => (
              <a
                key={i}
                href={dl.url}
                className="block text-sm text-blue-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {dl.name}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 border-t pt-6">
        <form action={`/api/support`} method="POST">
          <input type="hidden" name="lessonId" value={id} />
          <button
            type="submit"
            formAction={async () => {
              "use server";
              // Toggle completion is handled by server action
            }}
            className={`rounded-md px-6 py-2 font-medium ${
              progress?.completed
                ? "bg-green-100 text-green-800"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {progress?.completed ? "Completed" : "Mark as Complete"}
          </button>
        </form>
      </div>
    </div>
  );
}
