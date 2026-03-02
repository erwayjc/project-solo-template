import { NextRequest, NextResponse } from "next/server";
import { resend } from "@/lib/resend/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { broadcastId } = await request.json();
  const admin = createAdminClient();

  const { data: broadcast } = await admin
    .from("broadcasts")
    .select("*")
    .eq("id", broadcastId)
    .single();

  if (!broadcast) {
    return NextResponse.json(
      { error: "Broadcast not found" },
      { status: 404 }
    );
  }

  // Get audience based on filter
  let query = admin
    .from("leads")
    .select("email")
    .eq("unsubscribed", false);

  const filter = broadcast.audience_filter as Record<string, unknown>;
  if (filter?.status) {
    query = query.eq("status", filter.status as string);
  }
  if (filter?.tags && Array.isArray(filter.tags)) {
    query = query.overlaps("tags", filter.tags as string[]);
  }

  const { data: recipients } = await query;

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: "No recipients" }, { status: 400 });
  }

  // Update broadcast status
  await admin
    .from("broadcasts")
    .update({ status: "sending" })
    .eq("id", broadcastId);

  // Pull sender from site_config
  const { data: siteConfig } = await supabase
    .from("site_config")
    .select("site_name, legal_contact_email")
    .eq("id", 1)
    .single();

  const fromName = (siteConfig?.site_name as string) || "Newsletter";
  const fromEmail = (siteConfig?.legal_contact_email as string) || "noreply@example.com";

  let sent = 0;
  let bounced = 0;

  for (const recipient of recipients) {
    try {
      const { data, error } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: recipient.email,
        subject: broadcast.subject,
        html: broadcast.body,
      });

      if (!error) {
        sent++;
        // Record the send
        await admin.from("email_sends").insert({
          recipient_email: recipient.email,
          resend_id: data?.id,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      }
    } catch {
      bounced++;
    }
  }

  // Update broadcast stats
  await admin
    .from("broadcasts")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      stats: { sent, delivered: 0, opened: 0, clicked: 0, bounced },
    })
    .eq("id", broadcastId);

  return NextResponse.json({ sent, total: recipients.length });
}
