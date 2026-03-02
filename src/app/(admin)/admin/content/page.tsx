import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Content - Admin" };

export default async function ContentPage() {
  const supabase = await createClient();

  const [{ data: posts }, { data: queue }] = await Promise.all([
    supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("content_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Content Manager</h1>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Blog Posts</h2>
        <div className="mt-4 overflow-hidden rounded-lg border">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {posts?.map((post) => (
                <tr key={post.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {post.title}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        post.status === "published"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {post.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {post.published_at
                      ? new Date(post.published_at).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Social Queue</h2>
        <div className="mt-4 space-y-3">
          {queue?.map((item) => (
            <div key={item.id} className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                  {item.platform}
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    item.status === "published"
                      ? "bg-green-100 text-green-700"
                      : item.status === "approved"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-700">{item.content}</p>
            </div>
          ))}
          {(!queue || queue.length === 0) && (
            <p className="text-sm text-gray-500">No content in queue.</p>
          )}
        </div>
      </div>
    </div>
  );
}
