// =============================================================================
// Edge Function: process-content-queue
// Schedule: Every 30 minutes
// Purpose: Publishes approved social-media content via the Buffer API and
//          updates each queue item's status to 'published' or 'failed'.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUFFER_API_URL = "https://api.bufferapp.com/1";

interface ContentQueueItem {
  id: string;
  platform: string;
  content: string;
  media_urls: string[];
  status: string;
  scheduled_for: string | null;
  buffer_id: string | null;
  source_content_id: string | null;
}

Deno.serve(async (_req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const bufferAccessToken = Deno.env.get("BUFFER_ACCESS_TOKEN");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!bufferAccessToken) {
      return new Response(
        JSON.stringify({ error: "Missing BUFFER_ACCESS_TOKEN" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // -----------------------------------------------------------------------
    // 1. Fetch approved content that is ready to publish
    //    - status = 'approved'
    //    - scheduled_for is null (publish immediately) OR scheduled_for <= now
    // -----------------------------------------------------------------------
    const now = new Date().toISOString();

    const { data: queueItems, error: fetchError } = await supabase
      .from("content_queue")
      .select("*")
      .eq("status", "approved")
      .or(`scheduled_for.is.null,scheduled_for.lte.${now}`);

    if (fetchError) {
      console.error("Error fetching content queue:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch content queue", detail: fetchError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ message: "No content to publish", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // -----------------------------------------------------------------------
    // 2. Fetch Buffer profiles to map platform -> profile_id
    //    Buffer requires a profile_id for each update.
    // -----------------------------------------------------------------------
    const profilesResponse = await fetch(
      `${BUFFER_API_URL}/profiles.json?access_token=${bufferAccessToken}`,
    );

    if (!profilesResponse.ok) {
      const profilesError = await profilesResponse.text();
      console.error("Buffer profiles error:", profilesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch Buffer profiles", detail: profilesError }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const bufferProfiles = await profilesResponse.json();

    // Build a platform -> profile_id map (use the first profile for each service)
    const platformProfileMap: Record<string, string> = {};
    for (const profile of bufferProfiles) {
      const service = (profile.service as string).toLowerCase();
      // Map Buffer service names to our platform names
      const platformName =
        service === "x" ? "twitter" :
        service === "twitter" ? "twitter" :
        service;
      if (!platformProfileMap[platformName]) {
        platformProfileMap[platformName] = profile.id;
      }
    }

    // -----------------------------------------------------------------------
    // 3. Publish each item to Buffer
    // -----------------------------------------------------------------------
    let published = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const item of queueItems as ContentQueueItem[]) {
      try {
        const profileId = platformProfileMap[item.platform];

        if (!profileId) {
          console.error(`No Buffer profile found for platform: ${item.platform}`);
          await supabase
            .from("content_queue")
            .update({ status: "failed" })
            .eq("id", item.id);
          errors.push(`No Buffer profile for platform "${item.platform}" (item ${item.id})`);
          failedCount++;
          continue;
        }

        // Build the Buffer create-update payload
        const bufferPayload: Record<string, unknown> = {
          access_token: bufferAccessToken,
          profile_ids: [profileId],
          text: item.content,
          now: true, // publish immediately
        };

        // Attach media if present
        if (item.media_urls && item.media_urls.length > 0) {
          bufferPayload.media = {
            photo: item.media_urls[0], // Buffer v1 supports one photo per update
          };
        }

        const bufferResponse = await fetch(`${BUFFER_API_URL}/updates/create.json`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(
            flattenForForm(bufferPayload),
          ).toString(),
        });

        const bufferResult = await bufferResponse.json();

        if (!bufferResponse.ok || !bufferResult.success) {
          console.error("Buffer API error:", bufferResult);
          await supabase
            .from("content_queue")
            .update({ status: "failed" })
            .eq("id", item.id);
          errors.push(`Buffer error for item ${item.id}: ${bufferResult.message || "Unknown error"}`);
          failedCount++;
          continue;
        }

        // Extract the update ID from the Buffer response
        const bufferId =
          bufferResult.updates?.[0]?.id ||
          bufferResult.update?.id ||
          null;

        // Mark as published
        await supabase
          .from("content_queue")
          .update({
            status: "published",
            buffer_id: bufferId,
          })
          .eq("id", item.id);

        published++;
      } catch (err) {
        console.error(`Error publishing item ${item.id}:`, err);
        await supabase
          .from("content_queue")
          .update({ status: "failed" })
          .eq("id", item.id);
        errors.push(`Exception for item ${item.id}: ${(err as Error).message}`);
        failedCount++;
      }
    }

    // -----------------------------------------------------------------------
    // 4. Return summary
    // -----------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        message: "Content queue processed",
        total: queueItems.length,
        published,
        failed: failedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unhandled error in process-content-queue:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

// ---------------------------------------------------------------------------
// Helper: flatten an object into string key-value pairs for form encoding.
// Handles nested objects like media.photo and array values like profile_ids[].
// ---------------------------------------------------------------------------
function flattenForForm(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        result[`${fullKey}[${i}]`] = String(v);
      });
    } else if (typeof value === "object" && value !== null) {
      Object.assign(result, flattenForForm(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}
