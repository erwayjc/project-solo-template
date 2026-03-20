// =============================================================================
// Edge Function: generate-briefing
// Schedule: Weekly (Monday)
// Purpose: Gathers key business metrics from the last 7 days (revenue, leads,
//          email performance, support tickets, content published), sends them to
//          the Anthropic Claude API for a natural-language CEO briefing, and
//          stores the result in site_config.metadata.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // -----------------------------------------------------------------------
    // Time window: last 7 days
    // -----------------------------------------------------------------------
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const nowISO = now.toISOString();
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    // -----------------------------------------------------------------------
    // 1. Revenue stats from purchases
    // -----------------------------------------------------------------------
    const { data: recentPurchases } = await supabase
      .from("purchases")
      .select("amount, currency, status")
      .gte("purchased_at", sevenDaysAgoISO)
      .lte("purchased_at", nowISO);

    const totalRevenue = (recentPurchases ?? [])
      .filter((p) => p.status === "active")
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const refundedAmount = (recentPurchases ?? [])
      .filter((p) => p.status === "refunded")
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const purchaseCount = (recentPurchases ?? []).filter(
      (p) => p.status === "active",
    ).length;

    const refundCount = (recentPurchases ?? []).filter(
      (p) => p.status === "refunded",
    ).length;

    // -----------------------------------------------------------------------
    // 2. New leads
    // -----------------------------------------------------------------------
    const { count: newLeadsCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgoISO)
      .lte("created_at", nowISO);

    // -----------------------------------------------------------------------
    // 3. Email performance (open rate)
    // -----------------------------------------------------------------------
    const { count: totalSent } = await supabase
      .from("email_sends")
      .select("*", { count: "exact", head: true })
      .gte("sent_at", sevenDaysAgoISO)
      .lte("sent_at", nowISO);

    const { count: totalOpened } = await supabase
      .from("email_sends")
      .select("*", { count: "exact", head: true })
      .not("opened_at", "is", null)
      .gte("sent_at", sevenDaysAgoISO)
      .lte("sent_at", nowISO);

    const emailsSent = totalSent ?? 0;
    const emailsOpened = totalOpened ?? 0;
    const openRate =
      emailsSent > 0
        ? Math.round((emailsOpened / emailsSent) * 100 * 100) / 100
        : 0;

    // -----------------------------------------------------------------------
    // 4. Active support tickets
    // -----------------------------------------------------------------------
    const { count: openTickets } = await supabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "escalated"]);

    const { count: newTicketsThisWeek } = await supabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgoISO)
      .lte("created_at", nowISO);

    const { count: resolvedThisWeek } = await supabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "resolved")
      .gte("resolved_at", sevenDaysAgoISO)
      .lte("resolved_at", nowISO);

    // -----------------------------------------------------------------------
    // 5. Content published
    // -----------------------------------------------------------------------
    const { count: postsPublished } = await supabase
      .from("blog_posts")
      .select("*", { count: "exact", head: true })
      .eq("status", "published")
      .gte("published_at", sevenDaysAgoISO)
      .lte("published_at", nowISO);

    const { count: socialPublished } = await supabase
      .from("content_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "published");

    // -----------------------------------------------------------------------
    // 6. Build the data summary for Claude
    // -----------------------------------------------------------------------
    const businessData = {
      period: {
        from: sevenDaysAgoISO,
        to: nowISO,
      },
      revenue: {
        total_cents: totalRevenue,
        total_formatted: `$${(totalRevenue / 100).toFixed(2)}`,
        purchase_count: purchaseCount,
        refund_count: refundCount,
        refunded_cents: refundedAmount,
        refunded_formatted: `$${(refundedAmount / 100).toFixed(2)}`,
      },
      leads: {
        new_this_week: newLeadsCount ?? 0,
      },
      email: {
        sent: emailsSent,
        opened: emailsOpened,
        open_rate_percent: openRate,
      },
      support: {
        currently_open: openTickets ?? 0,
        new_this_week: newTicketsThisWeek ?? 0,
        resolved_this_week: resolvedThisWeek ?? 0,
      },
      content: {
        blog_posts_published: postsPublished ?? 0,
        social_posts_published: socialPublished ?? 0,
      },
    };

    // -----------------------------------------------------------------------
    // 7. Generate the briefing via Anthropic Claude API
    // -----------------------------------------------------------------------
    const prompt = `You are a concise business analyst. Based on the following weekly metrics, write a brief CEO briefing (3-5 paragraphs). Highlight wins, flag concerns, and suggest 1-2 actionable next steps. Use plain language, no jargon. Format with clear section headers.

Business Metrics (Last 7 Days):
${JSON.stringify(businessData, null, 2)}`;

    const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errorBody = await anthropicResponse.text();
      console.error("Anthropic API error:", anthropicResponse.status, errorBody);
      return new Response(
        JSON.stringify({
          error: "Anthropic API request failed",
          status: anthropicResponse.status,
          detail: errorBody,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const anthropicResult = await anthropicResponse.json();

    // Extract the text content from the Claude response
    const briefingText =
      anthropicResult.content?.[0]?.text ?? "No briefing generated.";

    // -----------------------------------------------------------------------
    // 8. Store the briefing in site_config.metadata
    // -----------------------------------------------------------------------
    const { data: existingConfig } = await supabase
      .from("site_config")
      .select("metadata")
      .eq("id", 1)
      .single();

    const existingMetadata =
      (existingConfig?.metadata as Record<string, unknown>) ?? {};

    const updatedMetadata = {
      ...existingMetadata,
      latest_briefing: {
        generated_at: nowISO,
        period_from: sevenDaysAgoISO,
        period_to: nowISO,
        content: briefingText,
        metrics: businessData,
      },
    };

    const { error: updateError } = await supabase
      .from("site_config")
      .update({ metadata: updatedMetadata })
      .eq("id", 1);

    if (updateError) {
      console.error("Error storing briefing:", updateError);
      // Still return the briefing even if storage fails
    }

    console.log("Weekly briefing generated successfully");

    // -----------------------------------------------------------------------
    // 9. Return the briefing
    // -----------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        message: "Weekly briefing generated",
        generated_at: nowISO,
        briefing: briefingText,
        metrics: businessData,
        stored: !updateError,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unhandled error in generate-briefing:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
