import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      console.error("[api/ticket-history] No admin session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasServiceRoleKey()) {
      console.error("[api/ticket-history] No service role key");
      return NextResponse.json(
        { error: "Add SUPABASE_SERVICE_ROLE_KEY to .env.local" },
        { status: 503 }
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ticket_history")
      .select("*")
      .order("completed_at", { ascending: false });

    if (error) {
      console.error("[api/ticket-history] Database error:", JSON.stringify(error));
      // If table doesn't exist, return empty array instead of error
      if (error.code === '42P01') {
        console.log("[api/ticket-history] Table doesn't exist, returning empty array");
        return NextResponse.json([]);
      }
      throw error;
    }

    console.log("[api/ticket-history] Success, returning", data?.length || 0, "records");
    return NextResponse.json(data ?? []);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const errorDetails = error instanceof Error ? error.stack : JSON.stringify(error);
    console.error("[api/ticket-history] GET error:", message);
    console.error("[api/ticket-history] Error details:", errorDetails);
    return NextResponse.json({ error: message, details: errorDetails }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getAdminSession();
    if (!session) {
      console.error("[api/ticket-history] No admin session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasServiceRoleKey()) {
      console.error("[api/ticket-history] No service role key");
      return NextResponse.json(
        { error: "Add SUPABASE_SERVICE_ROLE_KEY to .env.local" },
        { status: 503 }
      );
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("ticket_history")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all records

    if (error) {
      console.error("[api/ticket-history] DELETE error:", JSON.stringify(error));
      throw error;
    }

    console.log("[api/ticket-history] DELETE success - all records deleted");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const errorDetails = error instanceof Error ? error.stack : JSON.stringify(error);
    console.error("[api/ticket-history] DELETE error:", message);
    console.error("[api/ticket-history] Error details:", errorDetails);
    return NextResponse.json({ error: message, details: errorDetails }, { status: 500 });
  }
}
