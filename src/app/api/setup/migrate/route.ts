import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const admin = createAdminClient();

  // Check if migration already ran
  const { data: config } = await admin
    .from("site_config")
    .select("id")
    .single();

  if (config) {
    return NextResponse.json({
      message: "Database already initialized",
      migrated: false,
    });
  }

  // In production, this would run SQL migrations.
  // For the template, Supabase migrations are applied via the CLI or during deploy.
  // This endpoint exists as a fallback for first-boot auto-migration.

  return NextResponse.json({
    message:
      "Please run Supabase migrations via CLI: npx supabase db push",
    migrated: false,
  });
}
