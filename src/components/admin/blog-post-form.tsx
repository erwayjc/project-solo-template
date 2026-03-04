'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBlogPost, updateBlogPost, checkBlogSlugAvailable } from '@/actions/content'
import { FieldGroup } from '@/components/forms/field-group'
import { RichTextEditor } from '@/components/forms/rich-text-editor'
import { ImageUpload } from '@/components/forms/image-upload'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import type { BlogPost } from '@/types/database'
import type { Json } from '@/lib/supabase/types'

interface BlogPostFormProps {
  post?: BlogPost
  onClose: () => void
  onSave: () => void
}

export function BlogPostForm({ post, onClose, onSave }: BlogPostFormProps) {
  const isEditing = !!post
  const [title, setTitle] = useState(post?.title ?? '')
  const [slug, setSlug] = useState(post?.slug ?? '')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEditing)
  const [content, setContent] = useState(post?.content ?? '')
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '')
  const [featuredImage, setFeaturedImage] = useState(
    post?.featured_image ?? ''
  )
  const [tagsInput, setTagsInput] = useState((post?.tags ?? []).join(', '))
  const [status, setStatus] = useState(post?.status ?? 'draft')
  const [seoExpanded, setSeoExpanded] = useState(false)
  const [metaTitle, setMetaTitle] = useState(
    (post?.seo as Record<string, string>)?.meta_title ?? ''
  )
  const [metaDescription, setMetaDescription] = useState(
    (post?.seo as Record<string, string>)?.meta_description ?? ''
  )
  const [ogImage, setOgImage] = useState(
    (post?.seo as Record<string, string>)?.og_image ?? ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [handleEscape])

  // Auto-generate slug from title (only on create and when not manually edited)
  useEffect(() => {
    if (!isEditing && !slugManuallyEdited) {
      setSlug(
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      )
    }
  }, [title, isEditing, slugManuallyEdited])

  async function handleSubmit(submitStatus?: string) {
    setLoading(true)
    setError(null)

    const finalStatus = submitStatus ?? status

    try {
      // Check slug uniqueness before saving
      const slugAvailable = await checkBlogSlugAvailable(slug, isEditing ? post.id : undefined)
      if (!slugAvailable) {
        setError('A blog post with this slug already exists. Please choose a different slug.')
        setLoading(false)
        return
      }

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const seoData = { meta_title: metaTitle, meta_description: metaDescription, og_image: ogImage }

      if (isEditing) {
        await updateBlogPost(post.id, {
          title,
          slug,
          content,
          excerpt,
          featured_image: featuredImage || null,
          tags,
          seo: seoData as unknown as Json,
          status: finalStatus,
        })
      } else {
        await createBlogPost({
          title,
          slug,
          content,
          excerpt,
          featured_image: featuredImage || undefined,
          tags,
          seo: seoData,
          status: finalStatus,
        })
      }
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save blog post')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Edit Blog Post' : 'New Blog Post'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="mx-4 flex h-[90vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-xl">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
            Close
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSubmit('draft')}
              disabled={loading}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('published')}
              disabled={loading}
              className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>

        {error && (
          <p className="mx-6 mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main column */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <FieldGroup label="Title" required>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-md border px-3 py-2 text-lg font-medium"
                placeholder="Your blog post title"
              />
            </FieldGroup>

            <FieldGroup
              label="Slug"
              description="URL-safe identifier"
              required
            >
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setSlugManuallyEdited(true)
                }}
                required
                className="w-full rounded-md border px-3 py-2 text-sm font-mono"
                placeholder="your-post-slug"
              />
            </FieldGroup>

            <FieldGroup label="Content">
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Write your blog post..."
                minRows={20}
              />
            </FieldGroup>
          </div>

          {/* Sidebar */}
          <div className="w-72 shrink-0 overflow-y-auto border-l bg-gray-50 p-4 space-y-5">
            <FieldGroup label="Status">
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="status"
                    value="draft"
                    checked={status === 'draft'}
                    onChange={() => setStatus('draft')}
                  />
                  Draft
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="status"
                    value="published"
                    checked={status === 'published'}
                    onChange={() => setStatus('published')}
                  />
                  Published
                </label>
              </div>
            </FieldGroup>

            <FieldGroup label="Featured Image">
              <ImageUpload
                value={featuredImage}
                onChange={setFeaturedImage}
              />
            </FieldGroup>

            <FieldGroup
              label="Excerpt"
              description="Short summary for cards and SEO"
            >
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Brief summary..."
              />
            </FieldGroup>

            <FieldGroup label="Tags" description="Comma-separated">
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="tutorial, react, tips"
              />
            </FieldGroup>

            {/* SEO Section */}
            <div>
              <button
                type="button"
                onClick={() => setSeoExpanded(!seoExpanded)}
                className="flex w-full items-center gap-1 text-sm font-medium text-gray-700"
              >
                {seoExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                SEO Settings
              </button>

              {seoExpanded && (
                <div className="mt-3 space-y-3">
                  <FieldGroup label="Meta Title">
                    <input
                      type="text"
                      value={metaTitle}
                      onChange={(e) => setMetaTitle(e.target.value)}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </FieldGroup>
                  <FieldGroup label="Meta Description">
                    <textarea
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      rows={2}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </FieldGroup>
                  <FieldGroup label="OG Image URL">
                    <input
                      type="text"
                      value={ogImage}
                      onChange={(e) => setOgImage(e.target.value)}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="https://..."
                    />
                  </FieldGroup>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
