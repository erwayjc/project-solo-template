import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { priceId, customerEmail } = await request.json();

  // Get the product/price from DB if priceId is "default"
  let stripePriceId = priceId;
  if (priceId === "default") {
    const { data: product } = await supabase
      .from("products")
      .select("stripe_price_id")
      .eq("is_active", true)
      .order("sort_order")
      .limit(1)
      .single();

    stripePriceId = product?.stripe_price_id;
  }

  if (!stripePriceId) {
    return NextResponse.json(
      { error: "No product configured" },
      { status: 400 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: `${siteUrl}/portal?checkout=success`,
    cancel_url: `${siteUrl}/checkout?canceled=true`,
    customer_email: customerEmail || user.email || undefined,
    metadata: {
      user_id: user.id,
    },
  });

  return NextResponse.json({ url: session.url });
}
