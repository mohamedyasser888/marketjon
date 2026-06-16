import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      console.error("[api/ticket-history/[id]] No admin session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasServiceRoleKey()) {
      console.error("[api/ticket-history/[id]] No service role key");
      return NextResponse.json(
        { error: "Add SUPABASE_SERVICE_ROLE_KEY to .env.local" },
        { status: 503 }
      );
    }

    const { id } = await params;
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("ticket_history")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[api/ticket-history/[id]] DELETE error:", JSON.stringify(error));
      throw error;
    }

    console.log("[api/ticket-history/[id]] DELETE success - record", id, "deleted");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const errorDetails = error instanceof Error ? error.stack : JSON.stringify(error);
    console.error("[api/ticket-history/[id]] DELETE error:", message);
    console.error("[api/ticket-history/[id]] Error details:", errorDetails);
    return NextResponse.json({ error: message, details: errorDetails }, { status: 500 });
  }
}
