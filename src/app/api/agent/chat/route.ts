import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentEngine } from "@/agents/engine";
import { McpClient } from "@/mcp/client";
import type { AgentProgressEvent } from "@/agents/types";

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

  // Resolve agent ID and fetch full agent record for permission checks
  const admin = createAdminClient();
  let resolvedAgentId = agentId;
  let agentRecord: { id: string; is_system: boolean; is_active: boolean; tools: string[] } | null = null;

  if (agentSlug && !agentId) {
    const { data: agent } = await admin
      .from("agents")
      .select("id, is_system, is_active, tools")
      .eq("slug", agentSlug)
      .eq("is_active", true)
      .single();
    agentRecord = agent;
    resolvedAgentId = agent?.id;
  } else if (resolvedAgentId) {
    const { data: agent } = await admin
      .from("agents")
      .select("id, is_system, is_active, tools")
      .eq("id", resolvedAgentId)
      .eq("is_active", true)
      .single();
    agentRecord = agent;
  }

  if (!resolvedAgentId || !agentRecord) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Permission check: system agents and agents with admin-level tools
  // require admin role. Non-admin users can only access non-system agents
  // that don't have admin-only tool access.
  const adminOnlyToolPrefixes = ["manage_", "update_site", "delete_", "create_agent", "update_agent"];
  const hasAdminTools = agentRecord.tools.some((tool: string) =>
    adminOnlyToolPrefixes.some((prefix) => tool.startsWith(prefix))
  );

  if (agentRecord.is_system || hasAdminTools) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "You do not have permission to use this agent" },
        { status: 403 }
      );
    }
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: AgentProgressEvent) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      }

      try {
        await mcpClient.loadInternalTools();

        const engine = new AgentEngine(mcpClient);
        await engine.run(resolvedAgentId, message, user.id, conversationId, send);
      } catch (error) {
        console.error("Agent chat error:", error);
        // Send error as a text event so the client can display it
        send({
          type: "text",
          content: "An error occurred while processing your request. Please try again.",
        });
        send({
          type: "done",
          conversationId: conversationId ?? "",
          toolCalls: [],
          tokensUsed: 0,
        });
      } finally {
        await mcpClient.disconnect();
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
