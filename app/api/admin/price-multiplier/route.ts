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
    const { multiplier } = body;

    if (typeof multiplier !== "number" || multiplier < 1 || multiplier > 15) {
      return NextResponse.json({ error: "Invalid multiplier value" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Update all products with the new price multiplier
    const { data: products, error: fetchError } = await supabase
      .from("products")
      .select("id, price");

    if (fetchError) {
      console.error("[price-multiplier] Fetch error:", fetchError);
      throw new Error("Failed to fetch products");
    }

    // Calculate new prices based on multiplier
    const updates = products.map((product: any) => {
      const newPrice = product.price * multiplier;
      return {
        id: product.id,
        price: newPrice,
      };
    });

    // Update all products
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from("products")
        .update({ price: update.price, updated_at: new Date().toISOString() })
        .eq("id", update.id);

      if (updateError) {
        console.error("[price-multiplier] Update error:", updateError);
        throw new Error(`Failed to update product ${update.id}`);
      }
    }

    console.log("[price-multiplier] Successfully updated", updates.length, "products with multiplier", multiplier);

    return NextResponse.json({ 
      success: true, 
      updatedCount: updates.length,
      multiplier 
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[price-multiplier] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return current multiplier (could be stored in a settings table, for now return default)
    return NextResponse.json({ multiplier: 1 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[price-multiplier] GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
