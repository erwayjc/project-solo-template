"use client";

import { LANDING_PAGE_TEMPLATES } from "@/lib/templates/landing-page-templates";

interface TemplatePickerProps {
  onSelect: (sections: Record<string, unknown>[]) => void;
  onSkip: () => void;
}

export function TemplatePicker({ onSelect, onSkip }: TemplatePickerProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Choose a template
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Start with a pre-built template or build your page from scratch.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Start from scratch */}
        <button
          type="button"
          onClick={onSkip}
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-gray-400 hover:bg-gray-50"
        >
          <span className="text-3xl text-gray-400">+</span>
          <span className="mt-2 text-sm font-medium text-gray-700">
            Start from scratch
          </span>
          <span className="mt-1 text-xs text-gray-500">
            Build your page section by section
          </span>
        </button>

        {/* Template cards */}
        {LANDING_PAGE_TEMPLATES.map((template) => (
          <div
            key={template.id}
            className="flex flex-col rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {template.name}
                </h3>
                <span className="mt-0.5 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {template.category}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {template.sections.length} sections
              </span>
            </div>

            <p className="mt-2 flex-1 text-xs leading-relaxed text-gray-500">
              {template.description}
            </p>

            <div className="mt-3 flex flex-wrap gap-1">
              {template.sections.map((section, i) => (
                <span
                  key={i}
                  className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
                >
                  {section.type as string}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onSelect(structuredClone(template.sections))}
              className="mt-4 rounded-md bg-gray-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-800"
            >
              Use Template
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
