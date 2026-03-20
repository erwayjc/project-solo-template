// =============================================================================
// Edge Function: check-engagement
// Schedule: Daily
// Purpose: Compares engagement metrics (email opens, new leads, support tickets)
//          over the last 7 days vs the previous 7 days and flags any metric
//          that has dropped by more than 20%.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface PeriodMetrics {
  emailOpens: number;
  newLeads: number;
  supportTickets: number;
}

interface MetricComparison {
  metric: string;
  current: number;
  previous: number;
  changePercent: number;
  warning: boolean;
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // -----------------------------------------------------------------------
    // Define time windows
    // -----------------------------------------------------------------------
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const nowISO = now.toISOString();
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();
    const fourteenDaysAgoISO = fourteenDaysAgo.toISOString();

    // -----------------------------------------------------------------------
    // 1. Email opens — count email_sends where opened_at is not null
    // -----------------------------------------------------------------------
    // Current 7 days
    const { count: currentOpens } = await supabase
      .from("email_sends")
      .select("*", { count: "exact", head: true })
      .not("opened_at", "is", null)
      .gte("sent_at", sevenDaysAgoISO)
      .lte("sent_at", nowISO);

    // Previous 7 days
    const { count: previousOpens } = await supabase
      .from("email_sends")
      .select("*", { count: "exact", head: true })
      .not("opened_at", "is", null)
      .gte("sent_at", fourteenDaysAgoISO)
      .lt("sent_at", sevenDaysAgoISO);

    // -----------------------------------------------------------------------
    // 2. New leads — count leads created in each window
    // -----------------------------------------------------------------------
    const { count: currentLeads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgoISO)
      .lte("created_at", nowISO);

    const { count: previousLeads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", fourteenDaysAgoISO)
      .lt("created_at", sevenDaysAgoISO);

    // -----------------------------------------------------------------------
    // 3. Support tickets — count tickets created in each window
    // -----------------------------------------------------------------------
    const { count: currentTickets } = await supabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgoISO)
      .lte("created_at", nowISO);

    const { count: previousTickets } = await supabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .gte("created_at", fourteenDaysAgoISO)
      .lt("created_at", sevenDaysAgoISO);

    // -----------------------------------------------------------------------
    // 4. Build comparison results
    // -----------------------------------------------------------------------
    const current: PeriodMetrics = {
      emailOpens: currentOpens ?? 0,
      newLeads: currentLeads ?? 0,
      supportTickets: currentTickets ?? 0,
    };

    const previous: PeriodMetrics = {
      emailOpens: previousOpens ?? 0,
      newLeads: previousLeads ?? 0,
      supportTickets: previousTickets ?? 0,
    };

    function calcChange(curr: number, prev: number): number {
      if (prev === 0) return curr === 0 ? 0 : 100;
      return ((curr - prev) / prev) * 100;
    }

    const comparisons: MetricComparison[] = [
      {
        metric: "email_opens",
        current: current.emailOpens,
        previous: previous.emailOpens,
        changePercent: Math.round(calcChange(current.emailOpens, previous.emailOpens) * 100) / 100,
        warning: false,
      },
      {
        metric: "new_leads",
        current: current.newLeads,
        previous: previous.newLeads,
        changePercent: Math.round(calcChange(current.newLeads, previous.newLeads) * 100) / 100,
        warning: false,
      },
      {
        metric: "support_tickets",
        current: current.supportTickets,
        previous: previous.supportTickets,
        changePercent: Math.round(calcChange(current.supportTickets, previous.supportTickets) * 100) / 100,
        warning: false,
      },
    ];

    // Flag warnings: a drop of more than 20% (changePercent < -20)
    // For support tickets, an *increase* of >20% is also noteworthy, but per
    // the spec we only flag drops in the positive engagement metrics (opens, leads).
    // For tickets, a drop means fewer issues — that is good. So we check all
    // three for a >20% drop to keep it simple as requested.
    const warnings: string[] = [];

    for (const c of comparisons) {
      if (c.changePercent < -20) {
        c.warning = true;
        warnings.push(
          `${c.metric} dropped ${Math.abs(c.changePercent)}% (${c.previous} -> ${c.current})`,
        );
      }
    }

    if (warnings.length > 0) {
      console.warn("Engagement warnings detected:", warnings);
    }

    // -----------------------------------------------------------------------
    // 5. Return the summary
    // -----------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        message: "Engagement check complete",
        period: {
          current: { from: sevenDaysAgoISO, to: nowISO },
          previous: { from: fourteenDaysAgoISO, to: sevenDaysAgoISO },
        },
        metrics: comparisons,
        warnings: warnings.length > 0 ? warnings : undefined,
        hasWarnings: warnings.length > 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unhandled error in check-engagement:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
