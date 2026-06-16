import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json(
        {
          error:
            "Add SUPABASE_SERVICE_ROLE_KEY to .env.local, then restart npm run dev.",
        },
        { status: 503 }
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data ?? [], {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/tickets] GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json(
        { error: "Add SUPABASE_SERVICE_ROLE_KEY to .env.local" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { assigned_by } = body;

    const url = new URL(request.url);
    const ticketId = url.pathname.split('/').pop();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("tickets")
      .update({ assigned_by })
      .eq("id", ticketId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/tickets] PATCH error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
