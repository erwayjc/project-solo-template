import Link from "next/link";
import { getFunnels } from "@/actions/funnels";

export const metadata = { title: "Funnels - Admin" };

export default async function FunnelsPage() {
  const funnels = await getFunnels();

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    active: "bg-green-100 text-green-700",
    paused: "bg-yellow-100 text-yellow-700",
    archived: "bg-red-100 text-red-700",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Funnels</h1>
      <p className="mt-1 text-sm text-gray-500">
        Conversion-focused page sequences with analytics
      </p>

      {funnels.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-lg text-gray-500">No funnels yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            Ask your Dev Agent to create one!
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Steps
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Views
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Conversions
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {funnels.map((funnel) => (
                <tr key={funnel.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <Link
                      href={`/admin/funnels/${funnel.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {funnel.name}
                    </Link>
                    {funnel.description && (
                      <p className="mt-0.5 text-xs text-gray-400 truncate max-w-xs">
                        {funnel.description}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[funnel.status] || "bg-gray-100 text-gray-700"}`}
                    >
                      {funnel.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-700">
                    {funnel.step_count}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-700">
                    {funnel.total_views.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-700">
                    {funnel.total_conversions.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900">
                    {funnel.conversion_rate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
