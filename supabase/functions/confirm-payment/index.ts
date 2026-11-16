// Supabase Edge Function: confirm-payment
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify User Session from Token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Check Role
    const { data: adminUser, error: roleErr } = await supabase
      .from("admin_users")
      .select("id, full_name, role, is_active")
      .eq("id", user.id)
      .single();

    if (roleErr || !adminUser || !adminUser.is_active) {
      return new Response(JSON.stringify({ error: "Unauthorized: Active staff account required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!["owner", "manager", "cashier"].includes(adminUser.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permission: Payment confirmation requires Cashier, Manager, or Owner role" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Parse and Validate Request
    const { order_id, payment_method, amount_received, upi_reference } = await req.json();

    if (!order_id) {
      return new Response(JSON.stringify({ error: "Order ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (order.payment_status === "paid") {
      return new Response(JSON.stringify({ error: "Payment for this order has already been confirmed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const numericAmount = parseFloat(amount_received);
    if (isNaN(numericAmount) || numericAmount < Number(order.total_amount)) {
      return new Response(JSON.stringify({ 
        error: `Received amount (₹${amount_received}) cannot be less than order total (₹${order.total_amount})` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (payment_method === "upi" && (!upi_reference || upi_reference.trim().length < 4)) {
      return new Response(JSON.stringify({ error: "UPI Reference / UTR number is required for UPI verification" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Record Payment Entry
    const { data: paymentRecord, error: payErr } = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        payment_method: payment_method,
        amount: Number(order.total_amount),
        payment_status: "paid",
        upi_reference: payment_method === "upi" ? upi_reference.trim() : null,
        verified_by: adminUser.id,
        cashier_name: adminUser.full_name,
        confirmed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (payErr || !paymentRecord) {
      throw new Error("Failed to record payment: " + payErr?.message);
    }

    // 5. Audit Event
    await supabase.from("payment_events").insert({
      payment_id: paymentRecord.id,
      order_id: order.id,
      event_type: "CONFIRMED",
      amount: Number(order.total_amount),
      performed_by: adminUser.id,
      metadata: {
        method: payment_method,
        amount_tendered: numericAmount,
        upi_reference: upi_reference || null,
        cashier: adminUser.full_name
      }
    });

    // 6. Update Order Status
    await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        updated_at: new Date().toISOString()
      })
      .eq("id", order.id);

    // 7. Update Active Daily Cash Session if Cash
    if (payment_method === "cash") {
      const today = new Date().toISOString().slice(0, 10);
      const { data: openSession } = await supabase
        .from("daily_cash_sessions")
        .select("id, cash_collections")
        .eq("status", "open")
        .eq("session_date", today)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openSession) {
        const newCollections = Number(openSession.cash_collections) + Number(order.total_amount);
        await supabase
          .from("daily_cash_sessions")
          .update({
            cash_collections: newCollections
          })
          .eq("id", openSession.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment successfully confirmed and recorded.",
        payment: paymentRecord
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
