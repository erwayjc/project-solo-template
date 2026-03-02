import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings - Admin" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: config } = await supabase
    .from("site_config")
    .select("*")
    .single();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="mt-8 space-y-8">
        {/* Integration Status */}
        <section className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Integration Status
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Connection status for all services.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              "Supabase",
              "Stripe",
              "Resend",
              "Anthropic",
              "Buffer",
            ].map((service) => (
              <div
                key={service}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <span className="h-2 w-2 rounded-full bg-gray-300" />
                <span className="text-sm font-medium text-gray-700">
                  {service}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Branding */}
        <section className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Site Name
              </label>
              <input
                type="text"
                defaultValue={config?.site_name || ""}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Tagline
              </label>
              <input
                type="text"
                defaultValue={config?.tagline || ""}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        {/* Master Context */}
        <section className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Master Context Document
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            This document is fed to every AI agent. Describe your business,
            customers, and voice.
          </p>
          <textarea
            defaultValue={config?.master_context || ""}
            rows={10}
            className="mt-4 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </section>
      </div>
    </div>
  );
}
