'use client'

import { useState } from 'react'
import { getBlogPosts, deleteBlogPost } from '@/actions/content'
import { BlogPostForm } from '@/components/admin/blog-post-form'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { BlogPost } from '@/types/database'

interface BlogPostsManagerProps {
  initialPosts: BlogPost[]
}

export function BlogPostsManager({ initialPosts }: BlogPostsManagerProps) {
  const [posts, setPosts] = useState(initialPosts)
  const [showForm, setShowForm] = useState(false)
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refreshPosts() {
    try {
      const { posts: fresh } = await getBlogPosts()
      setPosts(fresh)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh posts')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this blog post?')) return
    setLoading(id)
    setError(null)
    try {
      await deleteBlogPost(id)
      setPosts((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post')
    } finally {
      setLoading(null)
    }
  }

  const filteredPosts = search
    ? posts.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase())
      )
    : posts

  return (
    <>
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Blog Posts</h2>
        <button
          onClick={() => {
            setEditingPost(null)
            setShowForm(true)
          }}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Post
        </button>
      </div>

      <div className="mt-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search posts..."
          className="w-full max-w-sm rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {filteredPosts.length === 0 ? (
        <div className="mt-4 rounded-lg border-2 border-dashed p-12 text-center">
          <p className="text-sm text-gray-500">
            {search ? 'No matching posts.' : 'No blog posts yet.'}
          </p>
        </div>
      ) : (
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
                  Published
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Tags
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredPosts.map((post) => (
                <tr key={post.id}>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => {
                        setEditingPost(post)
                        setShowForm(true)
                      }}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600"
                    >
                      {post.title.length > 50
                        ? post.title.slice(0, 50) + '...'
                        : post.title}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        'rounded-full px-2 py-1 text-xs font-medium',
                        post.status === 'published'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      )}
                    >
                      {post.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {post.published_at
                      ? new Date(post.published_at).toLocaleDateString()
                      : '\u2014'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(post.tags ?? []).slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditingPost(post)
                          setShowForm(true)
                        }}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        disabled={loading === post.id}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <BlogPostForm
          post={editingPost ?? undefined}
          onClose={() => {
            setShowForm(false)
            setEditingPost(null)
          }}
          onSave={() => {
            setShowForm(false)
            setEditingPost(null)
            refreshPosts()
          }}
        />
      )}
    </>
  )
}
