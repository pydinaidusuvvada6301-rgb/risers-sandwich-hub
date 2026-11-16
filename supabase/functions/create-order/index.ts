// Supabase Edge Function: create-order
// Runtime: Deno / TypeScript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase server credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { customer_name, customer_phone, payment_method, notes, items, idempotency_key } = body;

    // 1. Validation
    if (!customer_name || typeof customer_name !== "string" || customer_name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Please enter a valid customer name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const cleanPhone = (customer_phone || "").replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return new Response(JSON.stringify({ error: "Please enter a valid 10-digit Indian mobile number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!payment_method || !["cash", "upi"].includes(payment_method)) {
      return new Response(JSON.stringify({ error: "Payment method must be 'cash' or 'upi'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "Order must contain at least one item" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Fetch current prices from database (NEVER TRUST CLIENT PRICES)
    const productIds = items.map((i: { product_id: string }) => i.product_id);
    const { data: dbProducts, error: prodErr } = await supabase
      .from("products")
      .select("id, name, price, is_available, is_active")
      .in("id", productIds);

    if (prodErr || !dbProducts) {
      throw new Error("Failed to verify products: " + (prodErr?.message || "Not found"));
    }

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    let calculatedTotal = 0;
    const orderItemsToInsert: Array<{
      product_id: string;
      product_name: string;
      unit_price: number;
      quantity: number;
      subtotal: number;
    }> = [];

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return new Response(JSON.stringify({ error: `Product ID not found: ${item.product_id}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (!product.is_active || !product.is_available) {
        return new Response(JSON.stringify({ error: `Product "${product.name}" is currently unavailable` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty <= 0 || qty > 50) {
        return new Response(JSON.stringify({ error: `Invalid quantity for ${product.name}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const unitPrice = Number(product.price);
      const subtotal = Math.round(unitPrice * qty * 100) / 100;
      calculatedTotal += subtotal;

      orderItemsToInsert.push({
        product_id: product.id,
        product_name: product.name,
        unit_price: unitPrice,
        quantity: qty,
        subtotal: subtotal
      });
    }

    calculatedTotal = Math.round(calculatedTotal * 100) / 100;

    // 3. Generate Sequential Daily Token atomically via RPC
    const { data: tokenNum, error: tokenErr } = await supabase.rpc("generate_daily_token");
    if (tokenErr) {
      throw new Error("Failed to generate token: " + tokenErr.message);
    }

    // 4. Generate Order Number & Cryptographic Tracking Reference
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const orderNumber = `RSH-${today}-${String(tokenNum).padStart(4, "0")}`;
    
    // Cryptographically secure tracking hash
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const trackingHash = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    // Upsert customer
    const { data: custData } = await supabase
      .from("customers")
      .upsert({ phone: cleanPhone, name: customer_name.trim() }, { onConflict: "phone" })
      .select("id")
      .single();

    // 5. Insert Order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        token_number: tokenNum,
        customer_id: custData?.id,
        customer_name: customer_name.trim(),
        customer_phone: cleanPhone,
        order_status: "received",
        payment_status: "pending",
        payment_method: payment_method,
        subtotal_amount: calculatedTotal,
        discount_amount: 0.00,
        total_amount: calculatedTotal,
        notes: (notes || "").trim().slice(0, 500),
        tracking_hash: trackingHash
      })
      .select()
      .single();

    if (orderErr || !order) {
      throw new Error("Failed to create order: " + (orderErr?.message || "Unknown error"));
    }

    // 6. Insert Order Items
    const itemsPayload = orderItemsToInsert.map((item) => ({
      ...item,
      order_id: order.id
    }));

    const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);
    if (itemsErr) {
      throw new Error("Failed to record order items: " + itemsErr.message);
    }

    // 7. Initial Status Log
    await supabase.from("order_status_history").insert({
      order_id: order.id,
      previous_status: null,
      new_status: "received",
      notes: "Order placed by customer via digital menu"
    });

    return new Response(
      JSON.stringify({
        success: true,
        order: {
          id: order.id,
          order_number: order.order_number,
          token_number: order.token_number,
          customer_name: order.customer_name,
          payment_method: order.payment_method,
          payment_status: order.payment_status,
          order_status: order.order_status,
          total_amount: order.total_amount,
          tracking_hash: order.tracking_hash,
          created_at: order.created_at
        }
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
