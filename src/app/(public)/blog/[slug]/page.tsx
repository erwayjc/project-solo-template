import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!post) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold text-gray-900">{post.title}</h1>
      {post.published_at && (
        <time className="mt-4 block text-sm text-gray-500">
          {new Date(post.published_at).toLocaleDateString()}
        </time>
      )}
      {post.featured_image && (
        /* eslint-disable-next-line @next/next/no-img-element -- dynamic user-provided URL */
        <img
          src={post.featured_image}
          alt={post.title}
          className="mt-8 w-full rounded-lg"
        />
      )}
      <div className="prose prose-lg mt-8 max-w-none">{post.content}</div>
    </article>
  );
}
