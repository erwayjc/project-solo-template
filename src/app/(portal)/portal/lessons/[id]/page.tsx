import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toggleLessonProgress } from "@/actions/courses";

const ALLOWED_VIDEO_DOMAINS = [
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
  "loom.com",
  "www.loom.com",
  "wistia.com",
  "fast.wistia.com",
];

function isAllowedVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      ALLOWED_VIDEO_DOMAINS.some(
        (domain) =>
          parsed.hostname === domain ||
          parsed.hostname.endsWith(`.${domain}`)
      )
    );
  } catch {
    return false;
  }
}

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

  if (!user) {
    redirect("/login");
  }

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*, modules(title, product_id)")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (!lesson) {
    notFound();
  }

  // Gate access: if module has a product_id, user must have an active purchase
  const mod = lesson.modules as {
    title: string;
    product_id: string | null;
  } | null;
  const moduleProductId = mod?.product_id;
  if (moduleProductId) {
    const { data: purchase } = await supabase
      .from("purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", moduleProductId)
      .eq("status", "active")
      .limit(1)
      .single();

    if (!purchase) {
      redirect("/portal/lessons");
    }
  }

  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("completed")
    .eq("user_id", user.id)
    .eq("lesson_id", id)
    .single();

  const downloads = Array.isArray(lesson.downloads)
    ? (lesson.downloads as { name: string; url: string }[])
    : [];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-gray-500">{mod?.title}</p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900">{lesson.title}</h1>

      {lesson.video_url &&
        (isAllowedVideoUrl(lesson.video_url) ? (
          <div className="mt-6 aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              src={lesson.video_url}
              className="h-full w-full"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="mt-6">
            <a
              href={lesson.video_url}
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Watch video
            </a>
          </div>
        ))}

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
        <form
          action={async () => {
            "use server";
            await toggleLessonProgress(id);
            revalidatePath(`/portal/lessons/${id}`);
          }}
        >
          <button
            type="submit"
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
