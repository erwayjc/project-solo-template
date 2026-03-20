"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { OnboardingProgress } from "@/types";
import { Kbd } from "@/components/ui/kbd";

const navGroups = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: "LayoutDashboard" }],
  },
  {
    label: "AI",
    items: [
      { href: "/admin/command-center", label: "Command Center", icon: "Activity" },
      { href: "/admin/dev-agent", label: "Dev Agent", icon: "Bot", shortcut: "⌘J" },
      { href: "/admin/agents", label: "Agents", icon: "Users" },
      { href: "/admin/skills", label: "Skills", icon: "Sparkles" },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/admin/leads", label: "Leads", icon: "UserPlus" },
      { href: "/admin/customers", label: "Customers", icon: "Users" },
      { href: "/admin/lessons", label: "Course Editor", icon: "BookOpen" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/admin/content", label: "Content", icon: "FileText" },
      { href: "/admin/calendar", label: "Calendar", icon: "CalendarDays" },
      { href: "/admin/testimonials", label: "Testimonials", icon: "Quote" },
      { href: "/admin/pages", label: "Pages", icon: "Globe" },
      { href: "/admin/funnels", label: "Funnels", icon: "GitBranch" },
      { href: "/admin/email", label: "Email", icon: "Mail" },
    ],
  },
  {
    label: "Support",
    items: [
      { href: "/admin/support", label: "Tickets", icon: "MessageSquare" },
    ],
  },
];

interface AdminSidebarProps {
  onboardingProgress?: OnboardingProgress;
  updateAvailable?: boolean;
}

export function AdminSidebar({ onboardingProgress, updateAvailable }: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Calculate progress count
  let completedCount = 0;
  const totalCount = 9;
  if (onboardingProgress) {
    const items = [
      onboardingProgress.quickWins.explored_admin,
      onboardingProgress.quickWins.created_first_post,
      onboardingProgress.quickWins.edited_homepage,
      onboardingProgress.powerUps.payments_connected,
      onboardingProgress.powerUps.email_connected,
      onboardingProgress.powerUps.ai_connected,
      onboardingProgress.powerUps.social_connected,
      onboardingProgress.personalization.brand_customized,
      onboardingProgress.personalization.context_configured,
    ];
    completedCount = items.filter(Boolean).length;
  }

  const showProgress =
    onboardingProgress && !onboardingProgress.guide_dismissed;

  const sidebarContent = (
    <>
      <div className="flex h-14 items-center border-b px-6">
        <Link href="/admin" className="text-lg font-bold text-gray-900">
          Admin
        </Link>
        <button
          type="button"
          className="ml-auto md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {group.label}
            </p>
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`group mb-0.5 flex items-center justify-between rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                    isActive
                      ? "border-l-2 border-blue-600 bg-blue-50/60 pl-[10px] text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span>{item.label}</span>
                  {"shortcut" in item && item.shortcut && (
                    <Kbd className="opacity-0 transition-opacity group-hover:opacity-100">
                      {item.shortcut}
                    </Kbd>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {showProgress && (
        <div className="border-t px-4 py-3">
          <Link href="/admin" className="block" onClick={() => setMobileOpen(false)}>
            <p className="text-xs font-medium text-gray-500">
              Setup: {completedCount}/{totalCount} complete
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{
                  width: `${(completedCount / totalCount) * 100}%`,
                }}
              />
            </div>
          </Link>
        </div>
      )}

      <div className="border-t px-3 py-3 space-y-0.5">
        <Link
          href="/admin/updates"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center justify-between rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
            pathname === "/admin/updates"
              ? "border-l-2 border-blue-600 bg-blue-50/60 pl-[10px] text-blue-700"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <span>Updates</span>
          {updateAvailable && (
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          )}
        </Link>
        <Link
          href="/admin/settings"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
            pathname === "/admin/settings"
              ? "border-l-2 border-blue-600 bg-blue-50/60 pl-[10px] text-blue-700"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          Settings
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        type="button"
        className="fixed bottom-4 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay + slide-in sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 flex h-full w-64 flex-col bg-white shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-white md:flex">
        {sidebarContent}
      </aside>
    </>
  );
}
