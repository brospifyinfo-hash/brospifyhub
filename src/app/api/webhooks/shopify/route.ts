import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PurchaseType } from "@/types/database";

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || "";

function verifyShopifyWebhook(body: string, hmacHeader: string): boolean {
  if (!SHOPIFY_WEBHOOK_SECRET) return true; // Skip in dev if no secret
  const hash = crypto.createHmac("sha256", SHOPIFY_WEBHOOK_SECRET).update(body, "utf8").digest("base64");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}

interface ShopifyOrder {
  id: number;
  email: string;
  total_price: string;
  line_items: Array<{
    product_id: number;
    variant_id: number;
    title: string;
    price: string;
    sku: string;
  }>;
  note_attributes?: Array<{ name: string; value: string }>;
  customer?: { id: number; email: string };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256") || "";

    // Verify webhook signature
    if (SHOPIFY_WEBHOOK_SECRET && !verifyShopifyWebhook(body, hmacHeader)) {
      console.error("Invalid Shopify webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const order: ShopifyOrder = JSON.parse(body);
    console.log("Shopify webhook received:", { orderId: order.id, email: order.email });

    // Extract user_id and product_id from note_attributes or URL params
    const noteAttrs = order.note_attributes || [];
    const userId = noteAttrs.find(n => n.name === "uid")?.value;
    const productId = noteAttrs.find(n => n.name === "pid")?.value;

    if (!userId || !productId) {
      console.error("Missing uid or pid in order note_attributes");
      return NextResponse.json({ error: "Missing user or product ID" }, { status: 400 });
    }

    // Determine purchase type based on price
    const totalPrice = parseFloat(order.total_price);
    const purchaseType: PurchaseType = totalPrice > 3 ? "upsell" : "initial";

    const supabase = createAdminClient();

    // Check if purchase already exists
    const { data: existing } = await supabase
      .from("user_purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .eq("purchase_type", purchaseType)
      .single();

    if (existing) {
      console.log("Purchase already recorded:", existing.id);
      return NextResponse.json({ success: true, message: "Already recorded" });
    }

    // Insert new purchase
    const { data, error } = await supabase.from("user_purchases").insert({
      user_id: userId,
      product_id: productId,
      purchase_type: purchaseType,
      shopify_order_id: order.id.toString(),
      amount_paid: totalPrice,
    }).select().single();

    if (error) {
      console.error("Error inserting purchase:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    console.log("Purchase recorded:", data);
    return NextResponse.json({ success: true, purchase: data });

  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}