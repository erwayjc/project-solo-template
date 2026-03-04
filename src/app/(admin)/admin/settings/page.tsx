import { createClient } from "@/lib/supabase/server";
import { getOnboardingProgress } from "@/actions/onboarding";
import { ActivateStripe } from "@/components/admin/activation/activate-stripe";
import { ActivateResend } from "@/components/admin/activation/activate-resend";
import { ActivateAnthropic } from "@/components/admin/activation/activate-anthropic";
import { ActivateBuffer } from "@/components/admin/activation/activate-buffer";
import { BrandingSettingsForm } from "@/components/admin/settings/branding-settings-form";
import { StructuredContextForm } from "@/components/admin/settings/structured-context-form";
import { SampleContentSection } from "@/components/admin/settings/sample-content-section";
import { GuideToggleSection } from "@/components/admin/settings/guide-toggle-section";
import type { BrandColors } from "@/types";

export const metadata = { title: "Settings - Admin" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: config }, progress] = await Promise.all([
    supabase.from("site_config").select("*").single(),
    getOnboardingProgress(),
  ]);

  const brandColors = (config?.brand_colors as unknown as BrandColors) ?? {
    primary: "#2563eb",
    secondary: "#1e40af",
    accent: "#f59e0b",
    background: "#ffffff",
    text: "#111827",
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="mt-8 space-y-8">
        {/* Integrations */}
        <section id="integrations" className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
          <p className="mt-1 text-sm text-gray-500">
            Connect services to unlock platform features.
          </p>
          <div className="mt-4 space-y-4">
            <ActivateStripe />
            <ActivateResend />
            <ActivateAnthropic />
            <ActivateBuffer />
          </div>
        </section>

        {/* Branding */}
        <section id="branding" className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
          <p className="mt-1 text-sm text-gray-500">
            Customize your business name, colors, and identity.
          </p>
          <div className="mt-4">
            <BrandingSettingsForm
              initialConfig={{
                site_name: config?.site_name || "",
                tagline: config?.tagline || "",
                logo_url: config?.logo_url ?? null,
                brand_colors: brandColors,
                legal_business_name: config?.legal_business_name ?? null,
                legal_contact_email: config?.legal_contact_email ?? null,
              }}
            />
          </div>
        </section>

        {/* Business Context */}
        <section id="context" className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Business Context
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Help your AI agents understand your business. This information is
            shared with all agents.
          </p>
          <div className="mt-4">
            <StructuredContextForm
              initialContext={config?.master_context || ""}
            />
          </div>
        </section>

        {/* Sample Content */}
        <section id="samples" className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Sample Content
          </h2>
          <div className="mt-4">
            <SampleContentSection />
          </div>
        </section>

        {/* Setup Guide */}
        <section id="guide" className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Getting Started Guide
          </h2>
          <div className="mt-4">
            <GuideToggleSection guideDismissed={progress.guide_dismissed} />
          </div>
        </section>
      </div>
    </div>
  );
}
