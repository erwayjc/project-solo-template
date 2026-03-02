import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Blog",
};

export default async function BlogPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, featured_image, published_at, tags")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900">Blog</h1>
      <div className="mt-8 grid gap-8">
        {posts?.map((post) => (
          <article key={post.id} className="border-b pb-8">
            <Link href={`/blog/${post.slug}`}>
              <h2 className="text-xl font-semibold text-gray-900 hover:text-blue-600">
                {post.title}
              </h2>
            </Link>
            {post.excerpt && (
              <p className="mt-2 text-gray-600">{post.excerpt}</p>
            )}
            <div className="mt-3 flex items-center gap-4">
              {post.published_at && (
                <time className="text-sm text-gray-500">
                  {new Date(post.published_at).toLocaleDateString()}
                </time>
              )}
              {post.tags?.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
        {(!posts || posts.length === 0) && (
          <p className="text-gray-500">No posts yet.</p>
        )}
      </div>
    </div>
  );
}
