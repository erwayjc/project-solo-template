import { getBlogPosts, getContentQueue } from '@/actions/content'
import { BlogPostsManager } from '@/components/admin/blog-posts-manager'

export const metadata = { title: 'Content - Admin' }

export default async function ContentPage() {
  const [{ posts }, queue] = await Promise.all([
    getBlogPosts(),
    getContentQueue(),
  ])

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold text-gray-900">Content Manager</h1>

      <BlogPostsManager initialPosts={posts} />

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Social Queue</h2>
          <a
            href="/admin/calendar"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Manage social content in the Content Calendar &rarr;
          </a>
        </div>
        <div className="mt-4 space-y-3">
          {queue.map((item) => (
            <div key={item.id} className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                  {item.platform}
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    item.status === 'published'
                      ? 'bg-green-100 text-green-700'
                      : item.status === 'approved'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-700">{item.content}</p>
            </div>
          ))}
          {queue.length === 0 && (
            <p className="text-sm text-gray-500">No content in queue.</p>
          )}
        </div>
      </div>
    </div>
  )
}
