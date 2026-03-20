"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPage, updatePage, deletePage } from "@/actions/pages";
import { SectionsEditor } from "./sections-editor";
import { TemplatePicker } from "./template-picker";
import type { Page } from "@/types/database";

interface PageFormProps {
  page?: Page;
}

export function PageForm({ page }: PageFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditing = !!page;

  const existingSeo = (page?.seo as Record<string, string>) ?? {};

  const [slug, setSlug] = useState(page?.slug ?? "");
  const [renderMode, setRenderMode] = useState<"sections" | "custom">(
    (page?.render_mode as "sections" | "custom") ?? "sections"
  );
  const [title, setTitle] = useState(existingSeo.title ?? "");
  const [description, setDescription] = useState(existingSeo.description ?? "");
  const [ogImage, setOgImage] = useState(existingSeo.og_image ?? "");
  const [isPublished, setIsPublished] = useState(page?.is_published ?? false);
  const [sections, setSections] = useState<Record<string, unknown>[]>(
    (page?.sections as Record<string, unknown>[]) ?? []
  );
  const [htmlContent, setHtmlContent] = useState(page?.html_content ?? "");
  const [showTemplatePicker, setShowTemplatePicker] = useState(!page);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /** Strip dangerous HTML tags and event handler attributes before saving */
  function stripDangerousHtml(html: string): string {
    // Remove script, iframe, object, embed tags and their content
    let cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    cleaned = cleaned.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
    cleaned = cleaned.replace(/<iframe[^>]*\/?>/gi, "");
    cleaned = cleaned.replace(/<object[\s\S]*?<\/object>/gi, "");
    cleaned = cleaned.replace(/<object[^>]*\/?>/gi, "");
    cleaned = cleaned.replace(/<embed[^>]*\/?>/gi, "");
    // Remove event handler attributes (on*)
    cleaned = cleaned.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    return cleaned;
  }

  const handleSave = (publish?: boolean) => {
    setError("");
    setSuccess("");

    const publishState = publish !== undefined ? publish : isPublished;

    startTransition(async () => {
      try {
        if (isEditing) {
          const safeHtml = renderMode === "custom" ? stripDangerousHtml(htmlContent) : undefined;
          await updatePage(page.slug, {
            seo: {
              title,
              description,
              og_image: ogImage,
              keywords: [],
            },
            is_published: publishState,
            ...(renderMode === "sections" ? { sections } : {}),
            ...(renderMode === "custom" && safeHtml !== undefined ? { html_content: safeHtml } : {}),
          });
          setIsPublished(publishState);
          setSuccess("Page saved successfully");
        } else {
          if (!slug) {
            setError("Slug is required");
            return;
          }
          const safeHtmlCreate = renderMode === "custom" ? stripDangerousHtml(htmlContent) : undefined;
          await createPage({
            slug,
            render_mode: renderMode,
            seo: {
              title,
              description,
              og_image: ogImage,
              keywords: [],
            },
            is_published: publishState,
            ...(renderMode === "sections" ? { sections } : {}),
            ...(renderMode === "custom" && safeHtmlCreate !== undefined ? { html_content: safeHtmlCreate } : {}),
          });
          router.push("/admin/pages");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  };

  const handleDelete = () => {
    if (!isEditing) return;
    if (!confirm("Are you sure you want to delete this page?")) return;

    setError("");
    startTransition(async () => {
      try {
        await deletePage(page.slug);
        router.push("/admin/pages");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  };

  const previewUrl =
    renderMode === "custom"
      ? `/p/${slug}?preview=true`
      : `/pages/${slug}`;

  if (showTemplatePicker && renderMode === "sections") {
    return (
      <TemplatePicker
        onSelect={(templateSections) => {
          setSections(templateSections);
          setShowTemplatePicker(false);
        }}
        onSkip={() => setShowTemplatePicker(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Metadata */}
      <div className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Page Settings</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Slug
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              disabled={isEditing}
              required={!isEditing}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              title="Lowercase letters, numbers, and hyphens only (e.g. my-page)"
              placeholder="my-page"
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
            />
            {slug && (
              <p className="mt-1 text-xs text-gray-400">
                URL: {renderMode === "custom" ? `/p/${slug}` : `/pages/${slug}`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Render Mode
            </label>
            <select
              value={renderMode}
              onChange={(e) => setRenderMode(e.target.value as "sections" | "custom")}
              disabled={isEditing}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="sections">Sections (No-code)</option>
              <option value="custom">Custom HTML</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Page Title (SEO)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Awesome Page"
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Description (SEO)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief description of this page..."
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            OG Image URL
          </label>
          <input
            type="text"
            value={ogImage}
            onChange={(e) => setOgImage(e.target.value)}
            placeholder="https://..."
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Content Editor */}
      <div className="rounded-lg border bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Content</h2>
          {isEditing && slug && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Preview page &#8599;
            </a>
          )}
        </div>

        {renderMode === "sections" ? (
          <SectionsEditor sections={sections} onChange={setSections} />
        ) : (
          <div>
            <textarea
              rows={20}
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="<div>Your custom HTML here...</div>"
              className="block w-full rounded-md border px-3 py-2 font-mono text-sm"
              spellCheck={false}
            />
            <p className="mt-2 text-xs text-gray-400">
              Inline styles are allowed. Script, iframe, object, and embed tags and event handler attributes (onclick, onerror, etc.) are stripped for security.
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Page"}
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={() => handleSave(!isPublished)}
              disabled={isPending}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                isPublished
                  ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                  : "bg-green-100 text-green-800 hover:bg-green-200"
              } disabled:opacity-50`}
            >
              {isPublished ? "Unpublish" : "Publish"}
            </button>
          )}

          <button
            type="button"
            onClick={() => router.push("/admin/pages")}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
