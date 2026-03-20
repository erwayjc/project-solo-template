// =============================================================================
// Edge Function: sync-stripe-data
// Schedule: Every 6 hours
// Purpose: Fetches recent Stripe charges/payment intents and syncs payment
//          statuses to the local purchases table. Also syncs customer emails
//          to profiles when a stripe_customer_id is present.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_API_URL = "https://api.stripe.com/v1";

interface StripeCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  refunded: boolean;
  amount_refunded: number;
  payment_intent: string | null;
  customer: string | null;
  receipt_email: string | null;
  created: number;
  metadata: Record<string, string>;
}

interface StripeListResponse {
  data: StripeCharge[];
  has_more: boolean;
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Missing STRIPE_SECRET_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // -----------------------------------------------------------------------
    // 1. Fetch recent charges from Stripe (last 24 hours, with buffer)
    //    We use a 24-hour window even though we run every 6 hours to catch
    //    any charges we might have missed in a previous run.
    // -----------------------------------------------------------------------
    const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

    // Use the simpler query param format Stripe expects
    const chargesUrl = `${STRIPE_API_URL}/charges?limit=100&created[gte]=${twentyFourHoursAgo}`;

    const chargesResponse = await fetch(chargesUrl, {
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
      },
    });

    if (!chargesResponse.ok) {
      const errorBody = await chargesResponse.text();
      console.error("Stripe API error:", chargesResponse.status, errorBody);
      return new Response(
        JSON.stringify({
          error: "Stripe API request failed",
          status: chargesResponse.status,
          detail: errorBody,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const chargesResult: StripeListResponse = await chargesResponse.json();
    const charges = chargesResult.data;

    if (!charges || charges.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recent Stripe charges to sync", synced: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // -----------------------------------------------------------------------
    // 2. Process each charge
    // -----------------------------------------------------------------------
    let updated = 0;
    let profilesSynced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const charge of charges) {
      try {
        // Use payment_intent or charge id to match our purchases
        const stripePaymentId = charge.payment_intent || charge.id;

        // -------------------------------------------------------------------
        // 2a. Find the matching purchase in our database
        // -------------------------------------------------------------------
        const { data: purchase } = await supabase
          .from("purchases")
          .select("id, status, user_id")
          .eq("stripe_payment_id", stripePaymentId)
          .single();

        if (!purchase) {
          // No matching purchase found -- this charge might not have been
          // created through our system, or the webhook already handled it.
          skipped++;
          continue;
        }

        // -------------------------------------------------------------------
        // 2b. Determine the correct status based on the Stripe charge
        // -------------------------------------------------------------------
        let newStatus: string;

        if (charge.refunded || charge.amount_refunded >= charge.amount) {
          newStatus = "refunded";
        } else if (charge.status === "succeeded") {
          newStatus = "active";
        } else if (charge.status === "failed") {
          newStatus = "cancelled";
        } else if (charge.status === "pending") {
          // Keep current status for pending charges
          newStatus = purchase.status;
        } else {
          newStatus = purchase.status;
        }

        // -------------------------------------------------------------------
        // 2c. Update the purchase if the status has changed
        // -------------------------------------------------------------------
        if (newStatus !== purchase.status) {
          const { error: updateError } = await supabase
            .from("purchases")
            .update({ status: newStatus })
            .eq("id", purchase.id);

          if (updateError) {
            console.error(`Error updating purchase ${purchase.id}:`, updateError);
            errors.push(`Failed to update purchase ${purchase.id}: ${updateError.message}`);
            continue;
          }

          updated++;
        } else {
          skipped++;
        }

        // -------------------------------------------------------------------
        // 2d. Sync customer email to the profile if available
        // -------------------------------------------------------------------
        if (charge.customer && charge.receipt_email && purchase.user_id) {
          const customerId =
            typeof charge.customer === "string"
              ? charge.customer
              : (charge.customer as unknown as { id: string }).id;

          // Check if the profile already has this stripe_customer_id
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, stripe_customer_id, email")
            .eq("id", purchase.user_id)
            .single();

          if (profile) {
            const updates: Record<string, string> = {};

            // Link the Stripe customer ID if not already set
            if (!profile.stripe_customer_id) {
              updates.stripe_customer_id = customerId;
            }

            // Sync email if the profile has no email but Stripe has one
            if (!profile.email && charge.receipt_email) {
              updates.email = charge.receipt_email;
            }

            if (Object.keys(updates).length > 0) {
              const { error: profileError } = await supabase
                .from("profiles")
                .update(updates)
                .eq("id", profile.id);

              if (profileError) {
                console.error(`Error syncing profile ${profile.id}:`, profileError);
                errors.push(`Failed to sync profile ${profile.id}: ${profileError.message}`);
              } else {
                profilesSynced++;
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error processing charge ${charge.id}:`, err);
        errors.push(`Exception for charge ${charge.id}: ${(err as Error).message}`);
      }
    }

    // -----------------------------------------------------------------------
    // 3. Also check for refunds via the Stripe Refunds endpoint to catch
    //    partial refunds or refunds processed outside of charges
    // -----------------------------------------------------------------------
    let refundsProcessed = 0;

    try {
      const refundsUrl = `${STRIPE_API_URL}/refunds?limit=50&created[gte]=${twentyFourHoursAgo}`;

      const refundsResponse = await fetch(refundsUrl, {
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
        },
      });

      if (refundsResponse.ok) {
        const refundsResult = await refundsResponse.json();
        const refunds = refundsResult.data ?? [];

        for (const refund of refunds) {
          const paymentIntent = refund.payment_intent;
          if (!paymentIntent) continue;

          // Check if this payment is in our purchases and not already refunded
          const { data: purchase } = await supabase
            .from("purchases")
            .select("id, status")
            .eq("stripe_payment_id", paymentIntent)
            .neq("status", "refunded")
            .single();

          if (purchase) {
            const { error: refundUpdateError } = await supabase
              .from("purchases")
              .update({ status: "refunded" })
              .eq("id", purchase.id);

            if (!refundUpdateError) {
              refundsProcessed++;
            } else {
              errors.push(`Failed to mark purchase ${purchase.id} as refunded: ${refundUpdateError.message}`);
            }
          }
        }
      }
    } catch (refundErr) {
      console.error("Error checking refunds:", refundErr);
      errors.push(`Refund sync error: ${(refundErr as Error).message}`);
    }

    // -----------------------------------------------------------------------
    // 4. Return summary
    // -----------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        message: "Stripe data sync complete",
        charges_checked: charges.length,
        purchases_updated: updated,
        refunds_processed: refundsProcessed,
        profiles_synced: profilesSynced,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unhandled error in sync-stripe-data:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
