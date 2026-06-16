import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const supabase = createAdminClient();
    const { id: ticketId } = await params;

    // Get the ticket first
    const { data: ticket, error: fetchError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (fetchError) throw fetchError;
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Create history record
    const { data: history, error: historyError } = await supabase
      .from("ticket_history")
      .insert({
        ticket_id: ticket.id,
        user_id: ticket.user_id,
        username: ticket.username,
        items: ticket.items,
        total_items: ticket.total_items,
        assigned_by: assigned_by || ticket.assigned_by,
      })
      .select()
      .single();

    if (historyError) throw historyError;

    // Delete the ticket from tickets table
    const { error: deleteError } = await supabase
      .from("tickets")
      .delete()
      .eq("id", ticketId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ history, deleted: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/tickets/submit] POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
