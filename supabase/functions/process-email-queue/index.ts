// =============================================================================
// Edge Function: process-email-queue
// Schedule: Every 15 minutes
// Purpose: Advances active sequence enrollments by sending the current step's
//          email via Resend, logging the send, and scheduling the next step.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_URL = "https://api.resend.com/emails";

interface SequenceEnrollment {
  id: string;
  email: string;
  sequence_id: string;
  current_step: number;
  status: string;
  last_sent_at: string | null;
  next_send_at: string | null;
}

interface SequenceStep {
  id: string;
  sequence_id: string;
  step_number: number;
  subject: string;
  body: string;
  delay_hours: number;
}

Deno.serve(async (_req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing RESEND_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // -----------------------------------------------------------------------
    // 1. Fetch all active enrollments whose next_send_at has arrived
    // -----------------------------------------------------------------------
    const { data: enrollments, error: enrollError } = await supabase
      .from("sequence_enrollments")
      .select("*")
      .eq("status", "active")
      .lte("next_send_at", new Date().toISOString());

    if (enrollError) {
      console.error("Error fetching enrollments:", enrollError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch enrollments", detail: enrollError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!enrollments || enrollments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No enrollments to process", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // -----------------------------------------------------------------------
    // 2. Get the sender email from site_config (fallback to a default)
    // -----------------------------------------------------------------------
    const { data: siteConfig } = await supabase
      .from("site_config")
      .select("site_name, legal_contact_email")
      .eq("id", 1)
      .single();

    const senderEmail = siteConfig?.legal_contact_email || "noreply@example.com";
    const senderName = siteConfig?.site_name || "My Business";

    // -----------------------------------------------------------------------
    // 3. Process each enrollment
    // -----------------------------------------------------------------------
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const enrollment of enrollments as SequenceEnrollment[]) {
      try {
        // -------------------------------------------------------------------
        // 3a. Check that the lead has not unsubscribed
        // -------------------------------------------------------------------
        const { data: lead } = await supabase
          .from("leads")
          .select("unsubscribed")
          .eq("email", enrollment.email)
          .single();

        if (lead?.unsubscribed) {
          // Mark the enrollment as unsubscribed so we stop checking it
          await supabase
            .from("sequence_enrollments")
            .update({ status: "unsubscribed" })
            .eq("id", enrollment.id);
          skipped++;
          continue;
        }

        // -------------------------------------------------------------------
        // 3b. Fetch the current step for this enrollment
        // -------------------------------------------------------------------
        const { data: currentStep, error: stepError } = await supabase
          .from("email_sequence_steps")
          .select("*")
          .eq("sequence_id", enrollment.sequence_id)
          .eq("step_number", enrollment.current_step)
          .single();

        if (stepError || !currentStep) {
          console.error(
            `Step ${enrollment.current_step} not found for sequence ${enrollment.sequence_id}:`,
            stepError,
          );
          errors.push(`Step not found for enrollment ${enrollment.id}`);
          failed++;
          continue;
        }

        const step = currentStep as SequenceStep;

        // -------------------------------------------------------------------
        // 3c. Send the email via Resend
        // -------------------------------------------------------------------
        const resendPayload = {
          from: `${senderName} <${senderEmail}>`,
          to: [enrollment.email],
          subject: step.subject,
          html: step.body,
        };

        const resendResponse = await fetch(RESEND_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(resendPayload),
        });

        const resendResult = await resendResponse.json();

        if (!resendResponse.ok) {
          console.error("Resend API error:", resendResult);
          errors.push(`Resend error for ${enrollment.email}: ${resendResult.message || "Unknown error"}`);
          failed++;
          continue;
        }

        // -------------------------------------------------------------------
        // 3d. Log the send in email_sends
        // -------------------------------------------------------------------
        await supabase.from("email_sends").insert({
          recipient_email: enrollment.email,
          sequence_id: enrollment.sequence_id,
          step_id: step.id,
          resend_id: resendResult.id || null,
          status: "sent",
          sent_at: new Date().toISOString(),
        });

        // -------------------------------------------------------------------
        // 3e. Check if there is a next step
        // -------------------------------------------------------------------
        const { data: nextStep } = await supabase
          .from("email_sequence_steps")
          .select("*")
          .eq("sequence_id", enrollment.sequence_id)
          .eq("step_number", enrollment.current_step + 1)
          .single();

        if (nextStep) {
          // Advance to the next step and schedule the next send
          const nextSendAt = new Date();
          nextSendAt.setHours(nextSendAt.getHours() + (nextStep as SequenceStep).delay_hours);

          await supabase
            .from("sequence_enrollments")
            .update({
              current_step: enrollment.current_step + 1,
              last_sent_at: new Date().toISOString(),
              next_send_at: nextSendAt.toISOString(),
            })
            .eq("id", enrollment.id);
        } else {
          // This was the last step -- mark enrollment as completed
          await supabase
            .from("sequence_enrollments")
            .update({
              status: "completed",
              last_sent_at: new Date().toISOString(),
              next_send_at: null,
              completed_at: new Date().toISOString(),
            })
            .eq("id", enrollment.id);
        }

        processed++;
      } catch (err) {
        console.error(`Error processing enrollment ${enrollment.id}:`, err);
        errors.push(`Exception for enrollment ${enrollment.id}: ${(err as Error).message}`);
        failed++;
      }
    }

    // -----------------------------------------------------------------------
    // 4. Return summary
    // -----------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        message: "Email queue processed",
        total: enrollments.length,
        processed,
        skipped,
        failed,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unhandled error in process-email-queue:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
