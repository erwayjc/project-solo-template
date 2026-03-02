import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { verifyWebhookSignature } from "@/lib/stripe/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

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
          .select("id")
          .eq("email", customerEmail)
          .single();

        if (profile) {
          await admin
            .from("profiles")
            .update({ role: "customer", stripe_customer_id: session.customer as string })
            .eq("id", profile.id);

          // Look up the product by Stripe price ID from the line items
          let productId: string | null = null;
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
          const priceId = lineItems.data[0]?.price?.id;
          if (priceId) {
            const { data: product } = await admin
              .from("products")
              .select("id")
              .eq("stripe_price_id", priceId)
              .single();
            productId = product?.id ?? null;
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
