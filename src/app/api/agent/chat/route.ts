import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentEngine } from "@/agents/engine";
import { McpClient } from "@/mcp/client";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, agentSlug, agentId, conversationId } =
    await request.json();

  if (!message) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  const mcpClient = new McpClient();

  try {
    const admin = createAdminClient();

    // Resolve agent
    let resolvedAgentId = agentId;
    if (agentSlug && !agentId) {
      const { data: agent } = await admin
        .from("agents")
        .select("id")
        .eq("slug", agentSlug)
        .eq("is_active", true)
        .single();
      resolvedAgentId = agent?.id;
    }

    if (!resolvedAgentId) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    await mcpClient.loadInternalTools();

    const engine = new AgentEngine(mcpClient);
    const result = await engine.run(resolvedAgentId, message, user.id, conversationId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Agent chat error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  } finally {
    // Always clean up MCP connections to prevent leaks
    await mcpClient.disconnect();
  }
}
