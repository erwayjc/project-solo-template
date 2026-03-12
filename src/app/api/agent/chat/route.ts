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

  // Resolve agent ID before starting the stream
  const admin = createAdminClient();
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
