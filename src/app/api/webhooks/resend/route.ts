import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Webhook } from "svix";
import { decrypt } from "@/lib/utils/encryption";
import { getResend } from "@/lib/resend/client";
import { AgentEngine } from "@/agents/engine";
import { McpClient } from "@/mcp/client";
import type { Json } from "@/lib/supabase/types";

interface InboundEmailData {
  email_id: string;
  from: string;
  to: string;
  subject: string;
}

interface DeliveryEventData {
  email_id: string;
}

type WebhookPayload =
  | { type: "email.received"; data: InboundEmailData }
  | { type: "email.delivered" | "email.opened" | "email.clicked" | "email.bounced"; data: DeliveryEventData };

/**
 * Resolve the Resend webhook signing secret.
 * Priority: env var > encrypted value in site_config.
 */
async function resolveWebhookSecret(): Promise<string | null> {
  // 1. Env var takes priority (backwards-compatible)
  if (process.env.RESEND_WEBHOOK_SECRET) {
    return process.env.RESEND_WEBHOOK_SECRET;
  }

  // 2. Fall back to encrypted secret stored in DB
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("site_config")
      .select("resend_webhook_secret")
      .eq("id", 1)
      .single();

    if (data?.resend_webhook_secret) {
      return decrypt(data.resend_webhook_secret as string);
    }
  } catch (err) {
    console.error("[Resend webhook] Failed to load webhook secret from DB:", err);
  }

  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  // Verify webhook signature using Resend's svix-based signing
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing webhook signature headers" }, { status: 400 });
  }

  const webhookSecret = await resolveWebhookSecret();
  if (!webhookSecret) {
    console.error("Resend webhook secret not configured (checked env var and site_config)");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    const wh = new Webhook(webhookSecret);
    payload = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookPayload;
  } catch (err) {
    console.error("Resend webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { type, data } = payload;

  switch (type) {
    case "email.delivered": {
      await admin
        .from("email_sends")
        .update({ status: "delivered" })
        .eq("resend_id", data.email_id);
      break;
    }

    case "email.opened": {
      await admin
        .from("email_sends")
        .update({ status: "opened", opened_at: new Date().toISOString() })
        .eq("resend_id", data.email_id)
        .is("opened_at", null);
      break;
    }

    case "email.clicked": {
      await admin
        .from("email_sends")
        .update({ status: "clicked" })
        .eq("resend_id", data.email_id);
      break;
    }

    case "email.bounced": {
      await admin
        .from("email_sends")
        .update({ status: "bounced" })
        .eq("resend_id", data.email_id);
      break;
    }

    case "email.received": {
      try {
        await handleInboundEmail(admin, data as InboundEmailData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes("duplicate key")) {
          console.log(`[Resend webhook] Duplicate inbound email skipped: ${(data as InboundEmailData).email_id}`);
        } else {
          throw err;
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// Inbound email handler — creates ticket, invokes CS agent
// ---------------------------------------------------------------------------

async function handleInboundEmail(
  admin: ReturnType<typeof createAdminClient>,
  data: InboundEmailData
) {
  const { email_id, from: senderAddress, to: toAddress, subject } = data;

  // Extract name/email from "Name <email>" format
  const fromMatch = senderAddress.match(/^(?:(.+?)\s*<)?([^<>]+)>?$/);
  const fromEmail = fromMatch?.[2]?.trim() ?? senderAddress;
  const fromName = fromMatch?.[1]?.trim() ?? null;

  // Idempotency: check if we already processed this email
  const { data: existing } = await admin
    .from("inbound_emails")
    .select("id")
    .eq("resend_email_id", email_id)
    .maybeSingle();

  if (existing) return; // Already processed — skip silently

  // 1. Load CS agent config from site_config
  const { data: siteConfig } = await admin
    .from("site_config")
    .select("cs_agent_config, admin_user_id")
    .eq("id", 1)
    .single();

  const csConfig = siteConfig?.cs_agent_config as { enabled: boolean; agent_slug: string; auto_reply: boolean } | null;

  // If CS agent is not enabled, just log the inbound email as pending
  if (!csConfig?.enabled) {
    await admin.from("inbound_emails").insert({
      resend_email_id: email_id,
      from_address: fromEmail,
      from_name: fromName,
      to_address: toAddress,
      subject,
      agent_response_status: "pending",
    });
    return;
  }

  // 2. Fetch full email body from Resend
  let textBody: string;
  try {
    const fullEmail = await getResend().emails.get(email_id);
    // Resend SDK returns { data: { text, html, ... } } or may vary by version
    const emailData = fullEmail as Record<string, unknown>;
    const nested = emailData.data as Record<string, unknown> | undefined;
    textBody = (nested?.text as string)
      ?? (emailData.text as string)
      ?? "";
  } catch (err) {
    console.error("[Resend webhook] Failed to fetch email body:", err);
    await admin.from("inbound_emails").insert({
      resend_email_id: email_id,
      from_address: fromEmail,
      from_name: fromName,
      to_address: toAddress,
      subject,
      agent_response_status: "failed",
    });
    return;
  }

  // 3. Look up sender in profiles to get user_id (use maybeSingle to handle non-unique emails)
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("email", fromEmail)
    .limit(1)
    .maybeSingle();

  const userId = profile?.id as string | null;

  // 4. Create support ticket
  const ticketMessages = [
    {
      role: "customer",
      content: textBody,
      timestamp: new Date().toISOString(),
    },
  ];

  const { data: ticket, error: ticketErr } = await admin
    .from("support_tickets")
    .insert({
      user_id: userId,
      subject: subject ?? "Email inquiry",
      messages: ticketMessages as unknown as Json,
      status: "open",
      source: "email",
      customer_email: fromEmail,
    })
    .select("id")
    .single();

  if (ticketErr) {
    console.error("[Resend webhook] Failed to create support ticket:", ticketErr.message);
    await admin.from("inbound_emails").insert({
      resend_email_id: email_id,
      from_address: fromEmail,
      from_name: fromName,
      to_address: toAddress,
      subject,
      body_snippet: textBody.slice(0, 500),
      agent_response_status: "failed",
    });
    return;
  }

  // 5. Insert inbound email record
  const { data: inboundRow } = await admin
    .from("inbound_emails")
    .insert({
      resend_email_id: email_id,
      from_address: fromEmail,
      from_name: fromName,
      to_address: toAddress,
      subject,
      body_snippet: textBody.slice(0, 500),
      support_ticket_id: ticket.id as string,
      agent_response_status: "pending",
    })
    .select("id")
    .single();

  const inboundId = inboundRow?.id as string | null;

  // 6. Check auto_reply — if disabled, stop after ticket creation (no agent invocation)
  if (!csConfig.auto_reply) {
    if (inboundId) {
      await admin
        .from("inbound_emails")
        .update({ agent_response_status: "pending", processed_at: new Date().toISOString() })
        .eq("id", inboundId);
    }
    return;
  }

  // 7. Guard against missing admin_user_id
  const adminUserId = siteConfig?.admin_user_id as string | null;
  if (!adminUserId) {
    console.error("[Resend webhook] admin_user_id not set in site_config — cannot invoke agent");
    if (inboundId) {
      await admin
        .from("inbound_emails")
        .update({ agent_response_status: "failed", processed_at: new Date().toISOString() })
        .eq("id", inboundId);
    }
    return;
  }

  // 8. Resolve the CS agent ID
  const agentSlug = csConfig.agent_slug ?? "support";
  const { data: agent } = await admin
    .from("agents")
    .select("id")
    .eq("slug", agentSlug)
    .eq("is_active", true)
    .single();

  if (!agent) {
    console.error(`[Resend webhook] CS agent "${agentSlug}" not found or inactive`);
    if (inboundId) {
      await admin
        .from("inbound_emails")
        .update({ agent_response_status: "failed", processed_at: new Date().toISOString() })
        .eq("id", inboundId);
    }
    return;
  }

  // 9. Invoke the CS agent
  const mcpClient = new McpClient();
  try {
    await mcpClient.loadInternalTools();
    const engine = new AgentEngine(mcpClient);

    const agentMessage = `[EMAIL FROM: ${fromEmail} | SUBJECT: ${subject ?? "No subject"}]\n\n${textBody}`;

    await engine.run(agent.id as string, agentMessage, adminUserId);

    // 8. Mark inbound email as processed
    if (inboundId) {
      await admin
        .from("inbound_emails")
        .update({ agent_response_status: "processed", processed_at: new Date().toISOString() })
        .eq("id", inboundId);
    }
  } catch (err) {
    console.error("[Resend webhook] Agent execution failed:", err);
    if (inboundId) {
      await admin
        .from("inbound_emails")
        .update({ agent_response_status: "failed", processed_at: new Date().toISOString() })
        .eq("id", inboundId);
    }
  } finally {
    await mcpClient.disconnect();
  }
}
