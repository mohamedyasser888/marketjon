import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_TICKET_STATUSES } from "@/lib/types/ticket";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { status, assigned_by, price } = body;

    const supabase = createAdminClient();

    // Handle price update for market tickets
    if (price !== undefined) {
      const { data: ticket } = await supabase
        .from("tickets")
        .select("items")
        .eq("id", id)
        .single();

      if (!ticket) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }

      const updatedItems = ticket.items.map((item: any) => ({
        ...item,
        price_label: price,
        price: parseFloat(price.replace(/[^0-9.]/g, '')) || 0,
      }));

      const { data, error } = await supabase
        .from("tickets")
        .update({ 
          items: updatedItems,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    // Handle assigned_by update
    if (assigned_by !== undefined) {
      const { data, error } = await supabase
        .from("tickets")
        .update({ 
          assigned_by,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    // Handle status update
    if (
      !status ||
      !ADMIN_TICKET_STATUSES.includes(
        status as (typeof ADMIN_TICKET_STATUSES)[number]
      )
    ) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("tickets")
      .update({ status: "deleted", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
