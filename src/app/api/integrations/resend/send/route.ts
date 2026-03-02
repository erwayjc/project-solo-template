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

  const { to, subject, html, sendId } = await request.json();

  if (!to || !subject || !html) {
    return NextResponse.json(
      { error: "to, subject, and html are required" },
      { status: 400 }
    );
  }

  try {
    // Pull sender from site_config
    const { data: siteConfig } = await supabase
      .from("site_config")
      .select("site_name, legal_contact_email")
      .eq("id", 1)
      .single();

    const fromName = (siteConfig?.site_name as string) || "Newsletter";
    const fromEmail = (siteConfig?.legal_contact_email as string) || "noreply@example.com";

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
    });

    if (error) {
      throw new Error(error.message);
    }

    // Update send record if provided
    if (sendId) {
      const admin = createAdminClient();
      await admin
        .from("email_sends")
        .update({
          resend_id: data?.id,
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", sendId);
    }

    return NextResponse.json({ success: true, emailId: data?.id });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
