"use client";

import { useState, useMemo } from "react";
import { FileText, Layout, ShoppingCart, Video, GraduationCap, User, Clock, Sparkles } from "lucide-react";

interface PageTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  design_notes: string;
}

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  landing: { label: "Landing", icon: Layout, color: "bg-blue-100 text-blue-700" },
  sales: { label: "Sales", icon: ShoppingCart, color: "bg-green-100 text-green-700" },
  "opt-in": { label: "Opt-in", icon: FileText, color: "bg-purple-100 text-purple-700" },
  webinar: { label: "Webinar", icon: Video, color: "bg-red-100 text-red-700" },
  "course-launch": { label: "Course", icon: GraduationCap, color: "bg-yellow-100 text-yellow-700" },
  about: { label: "About", icon: User, color: "bg-pink-100 text-pink-700" },
  waitlist: { label: "Waitlist", icon: Clock, color: "bg-indigo-100 text-indigo-700" },
  showcase: { label: "Showcase", icon: Sparkles, color: "bg-orange-100 text-orange-700" },
};

export function TemplateGallery({ templates }: { templates: PageTemplate[] }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(templates.map((t) => t.category))),
    [templates]
  );
  const filtered = useMemo(
    () => activeCategory
      ? templates.filter((t) => t.category === activeCategory)
      : templates,
    [templates, activeCategory]
  );

  return (
    <div>
      {/* Category filter tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            activeCategory === null
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All
        </button>
        {categories.map((cat) => {
          const config = categoryConfig[cat];
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {config?.label ?? cat}
            </button>
          );
        })}
      </div>

      {/* Template grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template) => {
          const config = categoryConfig[template.category] ?? {
            label: template.category,
            icon: FileText,
            color: "bg-gray-100 text-gray-700",
          };
          const Icon = config.icon;

          return (
            <div
              key={template.id}
              className="group rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              {/* Icon + category badge */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-gray-500 group-hover:bg-brand-primary/10 group-hover:text-brand-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}
                >
                  {config.label}
                </span>
              </div>

              {/* Name + description */}
              <h3 className="text-sm font-semibold text-gray-900">
                {template.name}
              </h3>
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                {template.description}
              </p>

              {/* Action hint */}
              <p className="mt-3 text-xs text-gray-400">
                Ask your Dev Agent: &quot;Create a page using the {template.name} template&quot;
              </p>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-lg text-gray-500">No templates in this category.</p>
        </div>
      )}
    </div>
  );
}
