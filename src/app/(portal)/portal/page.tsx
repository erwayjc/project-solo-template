import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TestimonialRequestBanner } from "@/components/portal/testimonial-request-banner";

export const metadata = { title: "Dashboard" };

export default async function PortalDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(5);

  return (
    <div className="mx-auto max-w-4xl">
      <TestimonialRequestBanner />
      <h1 className="text-2xl font-bold text-gray-900">
        Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
      </h1>

      {announcements && announcements.length > 0 && (
        <div className="mt-6 space-y-4">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={`rounded-lg border p-4 ${
                a.type === "alert"
                  ? "border-red-200 bg-red-50"
                  : a.type === "update"
                    ? "border-blue-200 bg-blue-50"
                    : "border-gray-200 bg-gray-50"
              }`}
            >
              <h3 className="font-semibold text-gray-900">{a.title}</h3>
              {a.content && (
                <p className="mt-1 text-sm text-gray-600">{a.content}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link
          href="/portal/lessons"
          className="rounded-lg border bg-white p-6 shadow-sm hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-gray-900">
            Continue Learning
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Pick up where you left off.
          </p>
        </Link>
        <Link
          href="/portal/support"
          className="rounded-lg border bg-white p-6 shadow-sm hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-gray-900">Get Help</h2>
          <p className="mt-1 text-sm text-gray-600">
            Chat with our AI support assistant.
          </p>
        </Link>
      </div>
    </div>
  );
}
