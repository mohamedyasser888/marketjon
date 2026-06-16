import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { buyer_name, seller_name, price, pieces, images } = body;

    if (!buyer_name || !seller_name) {
      return NextResponse.json({ error: "Buyer and seller names are required" }, { status: 400 });
    }

    if (!price && !pieces && (!images || images.length === 0)) {
      return NextResponse.json({ error: "Must provide price/pieces or upload images" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Create a washing ticket entry using a hardcoded admin ID
    // (Admin session is validated above, so we just need a valid UUID)
    const adminUserId = "00000000-0000-0000-0000-000000000001"; // System admin ID

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        user_id: adminUserId,
        username: buyer_name,
        items: [
          {
            kind: "washing",
            name: `Washing Service - Seller: ${seller_name}`,
            quantity: pieces ? parseInt(pieces.toString()) : 0,
            price: price ? parseFloat(price) : 0,
            price_label: price || "—",
            collection_name: "Washing",
            seller_name: seller_name,
            images: images && images.length > 0 ? images : [],
          },
        ],
        total_items: pieces ? parseInt(pieces.toString()) : 1,
        status: "finished",
        assigned_by: adminUserId,
      })
      .select()
      .single();

    if (ticketError) {
      console.error("[washing] Error creating ticket:", ticketError);
      return NextResponse.json({ error: ticketError.message || "Failed to create washing ticket" }, { status: 500 });
    }

    console.log("[washing] Successfully created washing ticket:", ticket.id);

    return NextResponse.json({ 
      success: true, 
      ticketId: ticket.id 
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[washing] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
