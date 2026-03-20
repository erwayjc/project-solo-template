"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Kbd } from "./kbd";

interface CommandItem {
  label: string;
  href: string;
  group: string;
  keywords?: string;
}

const commands: CommandItem[] = [
  // Overview
  { label: "Dashboard", href: "/admin", group: "Pages", keywords: "home overview" },
  // AI
  { label: "Command Center", href: "/admin/command-center", group: "Pages", keywords: "agents monitor" },
  { label: "Dev Agent", href: "/admin/dev-agent", group: "Pages", keywords: "ai chat developer" },
  { label: "Agents", href: "/admin/agents", group: "Pages", keywords: "ai bots" },
  { label: "Skills", href: "/admin/skills", group: "Pages", keywords: "tools abilities" },
  // Business
  { label: "Leads", href: "/admin/leads", group: "Pages", keywords: "contacts pipeline" },
  { label: "Customers", href: "/admin/customers", group: "Pages", keywords: "users subscribers" },
  { label: "Course Editor", href: "/admin/lessons", group: "Pages", keywords: "modules lessons content" },
  // Marketing
  { label: "Content", href: "/admin/content", group: "Pages", keywords: "blog posts social" },
  { label: "Content Calendar", href: "/admin/calendar", group: "Pages", keywords: "schedule plan" },
  { label: "Testimonials", href: "/admin/testimonials", group: "Pages", keywords: "reviews social proof" },
  { label: "Pages", href: "/admin/pages", group: "Pages", keywords: "landing sales" },
  { label: "Funnels", href: "/admin/funnels", group: "Pages", keywords: "conversion pipeline" },
  { label: "Email", href: "/admin/email", group: "Pages", keywords: "sequences broadcasts drip" },
  // Support
  { label: "Support Tickets", href: "/admin/support", group: "Pages", keywords: "help tickets" },
  // Settings
  { label: "Settings", href: "/admin/settings", group: "Pages", keywords: "config branding integrations" },
  // Quick Actions
  { label: "View Site", href: "/", group: "Quick Actions", keywords: "preview public" },
  { label: "New Blog Post", href: "/admin/content", group: "Quick Actions", keywords: "create write article" },
  { label: "New Page", href: "/admin/pages/new", group: "Quick Actions", keywords: "create landing" },
];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filtered = query.trim()
    ? commands.filter((cmd) => {
        const search = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(search) ||
          cmd.keywords?.toLowerCase().includes(search) ||
          cmd.group.toLowerCase().includes(search)
        );
      })
    : commands;

  // Group results
  const groups = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  const flatItems = Object.values(groups).flat();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setQuery("");
        setSelectedIndex(0);
      }
    },
    [],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function navigate(item: CommandItem) {
    setIsOpen(false);
    setQuery("");
    if (item.href === "/") {
      window.open("/", "_blank");
    } else {
      router.push(item.href);
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setIsOpen(false);
      setQuery("");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        navigate(flatItems[selectedIndex]);
      }
    }
  }

  if (!isOpen) return null;

  let itemIndex = -1;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={() => {
          setIsOpen(false);
          setQuery("");
        }}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg animate-in fade-in zoom-in-95 rounded-xl border border-gray-200 bg-white shadow-2xl duration-150">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search pages and actions..."
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto p-2">
          {Object.entries(groups).map(([groupName, items]) => (
            <div key={groupName}>
              <p className="px-3 py-1.5 text-xs font-medium text-gray-400">
                {groupName}
              </p>
              {items.map((item) => {
                itemIndex++;
                const idx = itemIndex;
                return (
                  <button
                    key={item.href}
                    onClick={() => navigate(item)}
                    className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selectedIndex === idx
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
          {flatItems.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-400">
              No results found.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Kbd>↑↓</Kbd> navigate</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> select</span>
          <span className="flex items-center gap-1"><Kbd>Esc</Kbd> close</span>
        </div>
      </div>
    </div>
  );
}
