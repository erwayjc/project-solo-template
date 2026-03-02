import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { leadSchema } from "@/lib/utils/validation";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate input with Zod
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { email, name, source } = parsed.data;
  const leadMagnet = body.leadMagnet;

  const admin = createAdminClient();

  // Create or update lead
  const { data: lead, error } = await admin
    .from("leads")
    .upsert(
      {
        email,
        name: name || null,
        source: source || "opt-in",
        lead_magnet: leadMagnet || null,
        status: "new",
      },
      { onConflict: "email" }
    )
    .select()
    .single();

  if (error) {
    console.error("Lead capture error:", error);
    return NextResponse.json(
      { error: "Failed to capture lead" },
      { status: 500 }
    );
  }

  // Enroll in welcome sequence
  const { data: welcomeSequence } = await admin
    .from("email_sequences")
    .select("id")
    .eq("trigger", "opt_in")
    .eq("is_active", true)
    .single();

  if (welcomeSequence) {
    await admin.from("sequence_enrollments").upsert(
      {
        email,
        sequence_id: welcomeSequence.id,
        current_step: 1,
        status: "active",
        next_send_at: new Date().toISOString(),
      },
      { onConflict: "email,sequence_id" }
    );
  }

  return NextResponse.json({ success: true, leadId: lead?.id });
}
