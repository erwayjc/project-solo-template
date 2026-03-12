import Link from "next/link";
import { getFunnelWithStats } from "@/actions/funnels";
import { FunnelPipeline } from "@/components/admin/funnel-pipeline";

export const metadata = { title: "Funnel Details - Admin" };

export default async function FunnelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { funnel, steps, overall_rate } = await getFunnelWithStats(id);

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    active: "bg-green-100 text-green-700",
    paused: "bg-yellow-100 text-yellow-700",
    archived: "bg-red-100 text-red-700",
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/funnels"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Funnels
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{funnel.name}</h1>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[funnel.status as string] || "bg-gray-100 text-gray-700"}`}
        >
          {funnel.status as string}
        </span>
      </div>
      {funnel.description && (
        <p className="mt-1 text-sm text-gray-500">
          {funnel.description as string}
        </p>
      )}
      <p className="mt-1 text-xs text-gray-400">
        Goal: {(funnel.goal_type as string).replace(/_/g, " ")}
      </p>

      <FunnelPipeline steps={steps} overallRate={overall_rate} />
    </div>
  );
}
