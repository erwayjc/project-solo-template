import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "CRON_SECRET",
] as const;

const REQUIRED_TABLES = [
  "profiles",
  "site_config",
  "products",
  "purchases",
  "modules",
  "lessons",
  "lesson_progress",
  "leads",
  "pages",
  "email_sequences",
  "email_sequence_steps",
  "email_sends",
  "broadcasts",
  "sequence_enrollments",
  "blog_posts",
  "content_queue",
  "support_tickets",
  "agents",
  "agent_conversations",
  "mcp_connections",
  "announcements",
  "media",
] as const;

const CRITICAL_FUNCTIONS = ["handle_new_user", "is_admin"] as const;

export async function GET(request: NextRequest) {
  // Structural checks require CRON_SECRET to prevent info disclosure (F1)
  const authHeader = request.headers.get("authorization");
  const isAuthorized =
    process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`;

  const connections: Record<string, { status: string; message?: string }> = {};
  const admin = createAdminClient();

  // --- Connection checks ---

  try {
    const { error } = await admin.from("site_config").select("id").single();
    connections.supabase = error
      ? { status: "error", message: error.message }
      : { status: "connected" };
  } catch {
    connections.supabase = { status: "error", message: "Connection failed" };
  }

  try {
    const { stripe } = await import("@/lib/stripe/client");
    await stripe.accounts.retrieve();
    connections.stripe = { status: "connected" };
  } catch {
    connections.stripe = {
      status: process.env.STRIPE_SECRET_KEY ? "error" : "not_configured",
      message: process.env.STRIPE_SECRET_KEY
        ? "Invalid key"
        : "No API key set",
    };
  }

  try {
    const { resend } = await import("@/lib/resend/client");
    await resend.domains.list();
    connections.resend = { status: "connected" };
  } catch {
    connections.resend = {
      status: process.env.RESEND_API_KEY ? "error" : "not_configured",
      message: process.env.RESEND_API_KEY ? "Invalid key" : "No API key set",
    };
  }

  try {
    const { anthropic } = await import("@/lib/claude/client");
    await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    connections.anthropic = { status: "connected" };
  } catch {
    connections.anthropic = {
      status: process.env.ANTHROPIC_API_KEY ? "error" : "not_configured",
      message: process.env.ANTHROPIC_API_KEY
        ? "Invalid key or no billing"
        : "No API key set",
    };
  }

  if (process.env.BUFFER_ACCESS_TOKEN) {
    try {
      const res = await fetch("https://api.bufferapp.com/1/user.json", {
        headers: {
          Authorization: `Bearer ${process.env.BUFFER_ACCESS_TOKEN}`,
        },
      });
      connections.buffer = res.ok
        ? { status: "connected" }
        : { status: "error", message: "Invalid token" };
    } catch {
      connections.buffer = { status: "error", message: "Connection failed" };
    }
  } else {
    connections.buffer = { status: "not_configured" };
  }

  // --- Environment variable checks ---

  const missingEnvVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  const environment = {
    status: (missingEnvVars.length === 0 ? "pass" : "warn") as
      | "pass"
      | "warn",
    missing: missingEnvVars as string[],
  };

  // --- Structural integrity checks (requires CRON_SECRET auth) ---

  if (!isAuthorized) {
    // Unauthenticated: return connection checks only (no info leak)
    const hasDegraded = Object.values(connections).some(
      (c) => c.status === "error" || c.status === "not_configured"
    );
    return NextResponse.json({
      connections,
      overall: hasDegraded ? "degraded" : "healthy",
    });
  }

  type CheckStatus = "pass" | "fail" | "skipped";

  let schema: {
    status: CheckStatus;
    missing_tables: string[];
    rls_disabled: string[];
  } = { status: "skipped", missing_tables: [], rls_disabled: [] };
  let criticalFunctions: { status: CheckStatus; missing: string[] } = {
    status: "skipped",
    missing: [],
  };
  let criticalTriggers: { status: CheckStatus; missing: string[] } = {
    status: "skipped",
    missing: [],
  };
  let siteConfig: { status: CheckStatus; message: string } = {
    status: "skipped",
    message: "Supabase not connected",
  };

  if (connections.supabase?.status === "connected") {
    // Call the introspection RPC function (not in generated types yet)
    const { data: healthData } = await (admin.rpc as Function)(
      "check_system_health"
    )
      .single()
      .catch(() => ({ data: null }));

    if (healthData) {
      const {
        existing_tables,
        rls_disabled_tables,
        existing_functions,
        existing_triggers,
      } = healthData as {
        existing_tables: string[];
        rls_disabled_tables: string[];
        existing_functions: string[];
        existing_triggers: string[];
      };

      // Required tables check
      schema.missing_tables = REQUIRED_TABLES.filter(
        (t) => !existing_tables.includes(t)
      );
      schema.rls_disabled = rls_disabled_tables;
      schema.status =
        schema.missing_tables.length > 0 || schema.rls_disabled.length > 0
          ? "fail"
          : "pass";

      // Critical functions check
      criticalFunctions.missing = CRITICAL_FUNCTIONS.filter(
        (f) => !existing_functions.includes(f)
      );
      criticalFunctions.status =
        criticalFunctions.missing.length > 0 ? "fail" : "pass";

      // Critical triggers check
      if (!existing_triggers.includes("on_auth_user_created")) {
        criticalTriggers = {
          status: "fail",
          missing: ["on_auth_user_created"],
        };
      } else {
        criticalTriggers.status = "pass";
      }
    } else {
      // RPC function doesn't exist — report honestly (F8)
      schema = {
        status: "skipped",
        missing_tables: [],
        rls_disabled: [],
      };
      criticalFunctions = { status: "skipped", missing: [] };
      criticalTriggers = { status: "skipped", missing: [] };
    }

    // Site config check (independent of RPC — queries table directly)
    const { data: config, error: configError } = await admin
      .from("site_config")
      .select("id, setup_complete")
      .eq("id", 1)
      .single();

    if (configError || !config) {
      siteConfig = {
        status: "fail",
        message: "site_config row (id=1) not found",
      };
    } else {
      siteConfig = { status: "pass", message: "OK" };
    }
  }

  // --- Overall status ---

  const hasCritical =
    schema.status === "fail" ||
    criticalFunctions.status === "fail" ||
    criticalTriggers.status === "fail" ||
    siteConfig.status === "fail";

  const hasSkipped =
    schema.status === "skipped" ||
    criticalFunctions.status === "skipped" ||
    criticalTriggers.status === "skipped";

  const hasDegraded =
    hasSkipped ||
    environment.status === "warn" ||
    Object.values(connections).some(
      (c) => c.status === "error" || c.status === "not_configured"
    );

  const overall = hasCritical
    ? "critical"
    : hasDegraded
      ? "degraded"
      : "healthy";

  // Return 503 for critical status (F12)
  const status = overall === "critical" ? 503 : 200;

  return NextResponse.json(
    {
      connections,
      environment,
      schema,
      critical_functions: criticalFunctions,
      critical_triggers: criticalTriggers,
      site_config: siteConfig,
      overall,
    },
    { status }
  );
}
