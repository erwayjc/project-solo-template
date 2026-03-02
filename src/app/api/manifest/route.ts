import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const { data: config } = await admin
    .from("site_config")
    .select("site_name, tagline, brand_colors, logo_url")
    .single();

  const colors = (config?.brand_colors as Record<string, string>) || {};
  const siteName = config?.site_name || "My Business";
  const shortName =
    siteName.length > 12 ? siteName.substring(0, 12) : siteName;

  const manifest = {
    name: siteName,
    short_name: shortName,
    description: config?.tagline || "",
    start_url: "/portal",
    display: "standalone",
    background_color: colors.background || "#ffffff",
    theme_color: colors.primary || "#2563eb",
    scope: "/portal/",
    icons: [
      {
        src: config?.logo_url || "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: config?.logo_url || "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
