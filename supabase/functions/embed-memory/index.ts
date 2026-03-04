// =============================================================================
// Edge Function: embed-memory
// Purpose: Generate gte-small embeddings for agent memories.
//
// Two modes:
//   1. Default (store): Generate embedding and write to agent_memories row.
//      Called by pg_net trigger on insert/update.
//      Body: { id: string, content: string }
//
//   2. Embed-only: Generate embedding and return it without writing to DB.
//      Called by the agent engine and search_memories MCP tool.
//      Body: { content: string, action: "embed-only" }
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-expect-error — Supabase.ai is available in the Edge Runtime but not typed
const model = new Supabase.ai.Session("gte-small");

Deno.serve(async (req: Request) => {
  try {
    // Only accept POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } },
      );
    }

    // Verify authorization — only the service role key is accepted
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey || token !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { content, action, id } = body as {
      content?: string;
      action?: string;
      id?: string;
    };

    // Validate content
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or empty content" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Generate embedding using gte-small (384 dimensions)
    const embedding = await model.run(content, {
      mean_pool: true,
      normalize: true,
    });

    // Convert to a plain array of numbers
    const embeddingArray = Array.from(embedding as Float32Array) as number[];

    // -----------------------------------------------------------------------
    // Mode: embed-only — return the vector without writing to DB
    // -----------------------------------------------------------------------
    if (action === "embed-only") {
      return new Response(
        JSON.stringify({ embedding: embeddingArray }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // -----------------------------------------------------------------------
    // Mode: store — write embedding to agent_memories row
    // -----------------------------------------------------------------------
    if (!id || typeof id !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing memory id for store mode" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Write the embedding to the agent_memories row
    const { error } = await supabase
      .from("agent_memories")
      .update({ embedding: JSON.stringify(embeddingArray) })
      .eq("id", id);

    if (error) {
      console.error("Failed to update memory embedding:", error);
      return new Response(
        JSON.stringify({ error: "Failed to store embedding" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unhandled error in embed-memory:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
