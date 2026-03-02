import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { contentId } = await request.json();
  const admin = createAdminClient();

  const { data: item } = await admin
    .from("content_queue")
    .select("*")
    .eq("id", contentId)
    .eq("status", "approved")
    .single();

  if (!item) {
    return NextResponse.json(
      { error: "Content not found or not approved" },
      { status: 404 }
    );
  }

  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Buffer not configured" },
      { status: 400 }
    );
  }

  try {
    // Publish to Buffer
    const res = await fetch("https://api.bufferapp.com/1/updates/create.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${token}`,
      },
      body: new URLSearchParams({
        text: item.content,
        ...(item.scheduled_for && {
          scheduled_at: item.scheduled_for,
        }),
      }),
    });

    const result = await res.json();

    await admin
      .from("content_queue")
      .update({
        status: "published",
        buffer_id: result.updates?.[0]?.id || null,
      })
      .eq("id", contentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Buffer publish error:", error);
    await admin
      .from("content_queue")
      .update({ status: "failed" })
      .eq("id", contentId);

    return NextResponse.json(
      { error: "Failed to publish" },
      { status: 500 }
    );
  }
}
