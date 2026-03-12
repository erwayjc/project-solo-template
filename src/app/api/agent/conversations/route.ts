import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const agentId = request.nextUrl.searchParams.get("agentId");
  const agentSlug = request.nextUrl.searchParams.get("agentSlug");

  // Resolve agent ID from slug if needed
  let resolvedAgentId = agentId;
  if (!resolvedAgentId && agentSlug) {
    const { data: agent } = await admin
      .from("agents")
      .select("id")
      .eq("slug", agentSlug)
      .eq("is_active", true)
      .single();

    if (agent) {
      resolvedAgentId = agent.id;
    }
  }

  // Use admin client with user_id filter for user-scoped access
  let query = admin
    .from("agent_conversations")
    .select("id, agent_id, title, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (resolvedAgentId) {
    query = query.eq("agent_id", resolvedAgentId);
  }

  const { data, error } = await query.limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    conversations: data,
    agentId: resolvedAgentId,
  });
}
