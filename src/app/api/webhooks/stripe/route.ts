import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { verifyWebhookSignature } from "@/lib/stripe/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend/client";
import { buildReceiptEmail, buildWelcomeEmail } from "@/lib/resend/templates";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = verifyWebhookSignature(body, signature);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customerEmail = session.customer_details?.email;

      if (customerEmail) {
        // Update profile to customer role
        const { data: profile } = await admin
          .from("profiles")
          .select("id, full_name")
          .eq("email", customerEmail)
          .single();

        let productId: string | null = null;
        let productName: string | null = null;

        if (profile) {
          await admin
            .from("profiles")
            .update({ role: "customer", stripe_customer_id: session.customer as string })
            .eq("id", profile.id);

          // Look up the product by Stripe price ID from the line items
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
          const priceId = lineItems.data[0]?.price?.id;
          if (priceId) {
            const { data: product } = await admin
              .from("products")
              .select("id, name")
              .eq("stripe_price_id", priceId)
              .single();
            productId = product?.id ?? null;
            productName = product?.name ?? null;
          }

          // Create purchase record if we have a matching product
          if (productId) {
            await admin.from("purchases").insert({
              user_id: profile.id,
              product_id: productId,
              stripe_payment_id: session.payment_intent as string,
              amount: session.amount_total || 0,
              currency: session.currency || "usd",
              status: "active",
            });
          }
        }

        // Convert lead if exists
        await admin
          .from("leads")
          .update({ status: "converted" })
          .eq("email", customerEmail);

        // ── Post-purchase: send emails & enroll in sequences ──

        // Load site config for sender info
        const { data: siteConfig } = await admin
          .from("site_config")
          .select("site_name, legal_contact_email")
          .eq("id", 1)
          .single();

        const fromName = siteConfig?.site_name || "My Business";
        const fromEmail = siteConfig?.legal_contact_email || process.env.RESEND_FROM_EMAIL;
        const customerName = profile?.full_name || customerEmail.split("@")[0];

        if (fromEmail) {
          const resend = getResend();

          // Send receipt email
          if (productName && session.amount_total) {
            try {
              const receipt = buildReceiptEmail(customerName, productName, session.amount_total);
              await resend.emails.send({
                from: `${fromName} <${fromEmail}>`,
                to: customerEmail,
                subject: receipt.subject,
                html: receipt.html,
              });
            } catch (err) {
              console.error("Failed to send receipt email:", err);
            }
          }

          // Send welcome email
          try {
            const welcome = buildWelcomeEmail(customerName);
            await resend.emails.send({
              from: `${fromName} <${fromEmail}>`,
              to: customerEmail,
              subject: welcome.subject,
              html: welcome.html,
            });
          } catch (err) {
            console.error("Failed to send welcome email:", err);
          }
        }

        // Enroll in purchase-triggered email sequences
        try {
          const { data: purchaseSequences } = await admin
            .from("email_sequences")
            .select("id")
            .eq("trigger", "purchase")
            .eq("is_active", true);

          if (purchaseSequences && purchaseSequences.length > 0) {
            // Check for existing enrollments to avoid duplicates
            const { data: existingEnrollments } = await admin
              .from("sequence_enrollments")
              .select("sequence_id")
              .eq("email", customerEmail)
              .in("sequence_id", purchaseSequences.map((s) => s.id));

            const alreadyEnrolled = new Set(
              existingEnrollments?.map((e) => e.sequence_id) || []
            );

            const newEnrollments = purchaseSequences
              .filter((s) => !alreadyEnrolled.has(s.id))
              .map((s) => ({
                email: customerEmail,
                sequence_id: s.id,
                current_step: 1,
                status: "active",
                started_at: new Date().toISOString(),
                next_send_at: new Date().toISOString(),
              }));

            if (newEnrollments.length > 0) {
              await admin.from("sequence_enrollments").insert(newEnrollments);
            }
          }
        } catch (err) {
          console.error("Failed to enroll in purchase sequences:", err);
        }
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object;
      console.log("Invoice paid:", invoice.id);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      if (subscription.status === "canceled") {
        await admin
          .from("purchases")
          .update({ status: "cancelled" })
          .eq("stripe_payment_id", subscription.id);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
