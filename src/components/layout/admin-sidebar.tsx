"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navGroups = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: "LayoutDashboard" }],
  },
  {
    label: "AI",
    items: [
      { href: "/admin/dev-agent", label: "Dev Agent", icon: "Bot" },
      { href: "/admin/agents", label: "Agents", icon: "Users" },
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

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r bg-white">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/admin" className="text-lg font-bold text-gray-900">
          Admin
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {group.label}
            </p>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-1 flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                  pathname === item.href
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t p-4">
        <Link
          href="/admin/settings"
          className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
            pathname === "/admin/settings"
              ? "bg-blue-50 text-blue-700"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          Settings
        </Link>
      </div>
    </aside>
  );
}
