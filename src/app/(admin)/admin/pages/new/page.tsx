import Link from "next/link";
import { PageForm } from "@/components/admin/page-form";

export const metadata = { title: "New Page - Admin" };

export default function NewPagePage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/pages"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Pages
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Create Page</h1>
      </div>
      <PageForm />
    </div>
  );
}
