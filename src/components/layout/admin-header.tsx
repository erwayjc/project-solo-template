"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const breadcrumbMap: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/dev-agent": "Dev Agent",
  "/admin/agents": "Agents",
  "/admin/content": "Content",
  "/admin/email": "Email",
  "/admin/leads": "Leads",
  "/admin/customers": "Customers",
  "/admin/lessons": "Course Editor",
  "/admin/support": "Support",
  "/admin/calendar": "Content Calendar",
  "/admin/testimonials": "Testimonials",
  "/admin/settings": "Settings",
  "/admin/setup": "Setup",
};

export function AdminHeader() {
  const pathname = usePathname();
  const title = breadcrumbMap[pathname] || "Admin";

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-700"
          target="_blank"
        >
          View Site
        </Link>
      </div>
    </header>
  );
}
