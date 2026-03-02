import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const results: Record<
    string,
    { status: string; message?: string }
  > = {};

  // Check Supabase
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("site_config").select("id").single();
    results.supabase = error
      ? { status: "error", message: error.message }
      : { status: "connected" };
  } catch {
    results.supabase = { status: "error", message: "Connection failed" };
  }

  // Check Stripe
  try {
    const { stripe } = await import("@/lib/stripe/client");
    await stripe.accounts.retrieve();
    results.stripe = { status: "connected" };
  } catch {
    results.stripe = {
      status: process.env.STRIPE_SECRET_KEY ? "error" : "not_configured",
      message: process.env.STRIPE_SECRET_KEY
        ? "Invalid key"
        : "No API key set",
    };
  }

  // Check Resend
  try {
    const { resend } = await import("@/lib/resend/client");
    await resend.domains.list();
    results.resend = { status: "connected" };
  } catch {
    results.resend = {
      status: process.env.RESEND_API_KEY ? "error" : "not_configured",
      message: process.env.RESEND_API_KEY ? "Invalid key" : "No API key set",
    };
  }

  // Check Anthropic
  try {
    const { anthropic } = await import("@/lib/claude/client");
    await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    results.anthropic = { status: "connected" };
  } catch {
    results.anthropic = {
      status: process.env.ANTHROPIC_API_KEY ? "error" : "not_configured",
      message: process.env.ANTHROPIC_API_KEY
        ? "Invalid key or no billing"
        : "No API key set",
    };
  }

  // Check Buffer
  if (process.env.BUFFER_ACCESS_TOKEN) {
    try {
      const res = await fetch("https://api.bufferapp.com/1/user.json", {
        headers: {
          Authorization: `Bearer ${process.env.BUFFER_ACCESS_TOKEN}`,
        },
      });
      results.buffer = res.ok
        ? { status: "connected" }
        : { status: "error", message: "Invalid token" };
    } catch {
      results.buffer = { status: "error", message: "Connection failed" };
    }
  } else {
    results.buffer = { status: "not_configured" };
  }

  return NextResponse.json(results);
}
