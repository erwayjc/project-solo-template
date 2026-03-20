"use client";

import { useRef, useState } from "react";

let _keyCounter = 0;
function useStableKeys<T extends object>() {
  const mapRef = useRef(new WeakMap<T, string>());
  return (item: T): string => {
    let key = mapRef.current.get(item);
    if (!key) {
      key = `k-${++_keyCounter}`;
      mapRef.current.set(item, key);
    }
    return key;
  };
}

type Section = Record<string, unknown>;

const SECTION_TYPES = [
  { value: "hero", label: "Hero" },
  { value: "benefits", label: "Benefits" },
  { value: "features", label: "Features" },
  { value: "feature_highlight", label: "Feature Highlight" },
  { value: "testimonials", label: "Testimonials" },
  { value: "pricing", label: "Pricing" },
  { value: "stats", label: "Stats" },
  { value: "faq", label: "FAQ" },
  { value: "logo_cloud", label: "Logo Cloud" },
  { value: "cta", label: "Call to Action" },
  { value: "body", label: "Text/Body" },
] as const;

function getDefaultSection(type: string): Section {
  switch (type) {
    case "hero":
      return { type: "hero", headline: "", body: "", cta: { text: "", url: "" } };
    case "benefits":
      return { type: "benefits", headline: "", items: [{ title: "", description: "" }] };
    case "testimonials":
      return { type: "testimonials", headline: "What Our Customers Say", items: [{ name: "", quote: "", role: "" }] };
    case "pricing":
      return { type: "pricing", headline: "", plans: [{ name: "", price: "", features: [""], cta: { text: "", url: "" } }] };
    case "cta":
      return { type: "cta", headline: "", body: "", cta: { text: "", url: "" } };
    case "features":
      return { type: "features", headline: "", subtitle: "", items: [{ icon: "", title: "", description: "" }] };
    case "feature_highlight":
      return { type: "feature_highlight", headline: "", body: "", image_url: "", image_alt: "", layout: "image_right", cta: { text: "", url: "" } };
    case "faq":
      return { type: "faq", headline: "", items: [{ question: "", answer: "" }] };
    case "stats":
      return { type: "stats", headline: "", items: [{ value: "", label: "" }] };
    case "logo_cloud":
      return { type: "logo_cloud", headline: "", items: [{ name: "", logo_url: "" }] };
    case "body":
      return { type: "body", headline: "", body: "" };
    default:
      return { type, headline: "", body: "" };
  }
}

function SectionCard({
  section,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  section: Section;
  index: number;
  total: number;
  onChange: (updated: Section) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const type = section.type as string;
  const headline = (section.headline as string) || "";

  return (
    <div className="rounded-lg border bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-900"
          aria-label={expanded ? "Collapse section" : "Expand section"}
        >
          <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>
            &#9654;
          </span>
          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {type}
          </span>
          <span className="text-gray-500">
            {headline || "(no headline)"}
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            title="Move up"
            aria-label="Move section up"
          >
            &#9650;
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="rounded p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            title="Move down"
            aria-label="Move section down"
          >
            &#9660;
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="ml-2 rounded p-1 text-red-400 hover:text-red-600"
            title="Remove section"
            aria-label="Remove section"
          >
            &#10005;
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 py-4">
          <SectionFields section={section} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

function SectionFields({
  section,
  onChange,
}: {
  section: Section;
  onChange: (updated: Section) => void;
}) {
  const type = section.type as string;

  const updateField = (field: string, value: unknown) => {
    onChange({ ...section, [field]: value });
  };

  return (
    <div className="space-y-4">
      {/* Headline — common to all types */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Headline</label>
        <input
          type="text"
          value={(section.headline as string) || ""}
          onChange={(e) => updateField("headline", e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {/* Body — for hero, cta, body types */}
      {(type === "hero" || type === "cta" || type === "body") && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Body</label>
          <textarea
            rows={3}
            value={(section.body as string) || ""}
            onChange={(e) => updateField("body", e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      )}

      {/* CTA — for hero, cta types */}
      {(type === "hero" || type === "cta") && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">CTA Text</label>
            <input
              type="text"
              value={((section.cta as Record<string, string>)?.text) || ""}
              onChange={(e) =>
                updateField("cta", {
                  ...(section.cta as Record<string, string>),
                  text: e.target.value,
                })
              }
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">CTA URL</label>
            <input
              type="text"
              value={((section.cta as Record<string, string>)?.url) || ""}
              onChange={(e) =>
                updateField("cta", {
                  ...(section.cta as Record<string, string>),
                  url: e.target.value,
                })
              }
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {/* Items — for benefits */}
      {type === "benefits" && (
        <ItemsEditor
          items={(section.items as { title: string; description: string }[]) || []}
          fields={["title", "description"]}
          onChange={(items) => updateField("items", items)}
        />
      )}

      {/* Items — for testimonials */}
      {type === "testimonials" && (
        <ItemsEditor
          items={(section.items as { name: string; quote: string; role: string }[]) || []}
          fields={["name", "quote", "role"]}
          onChange={(items) => updateField("items", items)}
        />
      )}

      {/* Plans — for pricing */}
      {type === "pricing" && (
        <PricingEditor
          plans={(section.plans as Record<string, unknown>[]) || []}
          onChange={(plans) => updateField("plans", plans)}
        />
      )}

      {/* Subtitle — for features */}
      {type === "features" && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Subtitle</label>
          <input
            type="text"
            value={(section.subtitle as string) || ""}
            onChange={(e) => updateField("subtitle", e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      )}

      {/* Items — for features (icon, title, description) */}
      {type === "features" && (
        <ItemsEditor
          items={(section.items as Record<string, string>[]) || []}
          fields={["icon", "title", "description"]}
          onChange={(items) => updateField("items", items)}
        />
      )}

      {/* Items — for faq (question, answer) */}
      {type === "faq" && (
        <ItemsEditor
          items={(section.items as Record<string, string>[]) || []}
          fields={["question", "answer"]}
          onChange={(items) => updateField("items", items)}
        />
      )}

      {/* Items — for stats (value, label) */}
      {type === "stats" && (
        <ItemsEditor
          items={(section.items as Record<string, string>[]) || []}
          fields={["value", "label"]}
          onChange={(items) => updateField("items", items)}
        />
      )}

      {/* Items — for logo_cloud (name, logo_url) */}
      {type === "logo_cloud" && (
        <ItemsEditor
          items={(section.items as Record<string, string>[]) || []}
          fields={["name", "logo_url"]}
          onChange={(items) => updateField("items", items)}
        />
      )}

      {/* Feature highlight fields */}
      {type === "feature_highlight" && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">Body</label>
            <textarea
              rows={3}
              value={(section.body as string) || ""}
              onChange={(e) => updateField("body", e.target.value)}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Image URL</label>
              <input
                type="text"
                value={(section.image_url as string) || ""}
                onChange={(e) => updateField("image_url", e.target.value)}
                placeholder="https://..."
                className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Image Alt Text</label>
              <input
                type="text"
                value={(section.image_alt as string) || ""}
                onChange={(e) => updateField("image_alt", e.target.value)}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Layout</label>
            <select
              value={(section.layout as string) || "image_right"}
              onChange={(e) => updateField("layout", e.target.value)}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="image_right">Image Right</option>
              <option value="image_left">Image Left</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">CTA Text</label>
              <input
                type="text"
                value={((section.cta as Record<string, string>)?.text) || ""}
                onChange={(e) =>
                  updateField("cta", {
                    ...(section.cta as Record<string, string>),
                    text: e.target.value,
                  })
                }
                className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">CTA URL</label>
              <input
                type="text"
                value={((section.cta as Record<string, string>)?.url) || ""}
                onChange={(e) =>
                  updateField("cta", {
                    ...(section.cta as Record<string, string>),
                    url: e.target.value,
                  })
                }
                className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ItemsEditor({
  items,
  fields,
  onChange,
}: {
  items: Record<string, string>[];
  fields: string[];
  onChange: (items: Record<string, string>[]) => void;
}) {
  const getKey = useStableKeys<Record<string, string>>();

  const addItem = () => {
    const empty: Record<string, string> = {};
    fields.forEach((f) => (empty[f] = ""));
    onChange([...items, empty]);
  };

  const updateItem = (index: number, field: string, value: string) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={getKey(item)} className="flex gap-2 items-start">
            <div className="flex-1 grid grid-cols-1 gap-2">
              {fields.map((field) => (
                <input
                  key={field}
                  type="text"
                  placeholder={field}
                  value={item[field] || ""}
                  onChange={(e) => updateItem(i, field, e.target.value)}
                  className="block w-full rounded-md border px-3 py-1.5 text-sm"
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="mt-1 text-red-400 hover:text-red-600 text-sm"
              aria-label="Remove item"
            >
              &#10005;
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="mt-2 text-sm text-blue-600 hover:text-blue-800"
      >
        + Add item
      </button>
    </div>
  );
}

function PricingEditor({
  plans,
  onChange,
}: {
  plans: Record<string, unknown>[];
  onChange: (plans: Record<string, unknown>[]) => void;
}) {
  const getKey = useStableKeys<Record<string, unknown>>();

  const addPlan = () => {
    onChange([...plans, { name: "", price: "", features: [""], cta: { text: "", url: "" } }]);
  };

  const updatePlan = (index: number, field: string, value: unknown) => {
    const updated = plans.map((plan, i) =>
      i === index ? { ...plan, [field]: value } : plan
    );
    onChange(updated);
  };

  const removePlan = (index: number) => {
    onChange(plans.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Plans</label>
      <div className="space-y-4">
        {plans.map((plan, i) => (
          <div key={getKey(plan)} className="rounded border p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-xs font-medium text-gray-500">Plan {i + 1}</span>
              <button type="button" onClick={() => removePlan(i)} className="text-red-400 hover:text-red-600 text-xs">
                Remove
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Plan name"
                value={(plan.name as string) || ""}
                onChange={(e) => updatePlan(i, "name", e.target.value)}
                className="rounded-md border px-3 py-1.5 text-sm"
              />
              <input
                type="text"
                placeholder="Price (e.g. $29/mo)"
                value={(plan.price as string) || ""}
                onChange={(e) => updatePlan(i, "price", e.target.value)}
                className="rounded-md border px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Features (one per line)</label>
              <textarea
                rows={3}
                value={((plan.features as string[]) || []).join("\n")}
                onChange={(e) =>
                  updatePlan(i, "features", e.target.value.split("\n"))
                }
                className="mt-1 block w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="CTA text"
                value={((plan.cta as Record<string, string>)?.text) || ""}
                onChange={(e) =>
                  updatePlan(i, "cta", {
                    ...(plan.cta as Record<string, string>),
                    text: e.target.value,
                  })
                }
                className="rounded-md border px-3 py-1.5 text-sm"
              />
              <input
                type="text"
                placeholder="CTA URL"
                value={((plan.cta as Record<string, string>)?.url) || ""}
                onChange={(e) =>
                  updatePlan(i, "cta", {
                    ...(plan.cta as Record<string, string>),
                    url: e.target.value,
                  })
                }
                className="rounded-md border px-3 py-1.5 text-sm"
              />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addPlan}
        className="mt-2 text-sm text-blue-600 hover:text-blue-800"
      >
        + Add plan
      </button>
    </div>
  );
}

interface SectionsEditorProps {
  sections: Section[];
  onChange: (sections: Section[]) => void;
}

export function SectionsEditor({ sections, onChange }: SectionsEditorProps) {
  const [addType, setAddType] = useState("hero");
  const getKey = useStableKeys<Section>();

  const handleAdd = () => {
    onChange([...sections, getDefaultSection(addType)]);
  };

  const handleRemove = (index: number) => {
    onChange(sections.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, updated: Section) => {
    onChange(sections.map((s, i) => (i === index ? updated : s)));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...sections];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === sections.length - 1) return;
    const updated = [...sections];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {sections.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">
          No sections yet. Add one below.
        </p>
      )}

      {sections.map((section, index) => (
        <SectionCard
          key={getKey(section)}
          section={section}
          index={index}
          total={sections.length}
          onChange={(updated) => handleChange(index, updated)}
          onRemove={() => handleRemove(index)}
          onMoveUp={() => handleMoveUp(index)}
          onMoveDown={() => handleMoveDown(index)}
        />
      ))}

      <div className="flex items-center gap-2 pt-2">
        <select
          value={addType}
          onChange={(e) => setAddType(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          {SECTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Add Section
        </button>
      </div>
    </div>
  );
}
