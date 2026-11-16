// Supabase Edge Function: export-transactions
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

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Role check: Only Owner and Manager can export sensitive financial transactions
    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id, role, is_active")
      .eq("id", user.id)
      .single();

    if (!adminUser || !adminUser.is_active || !["owner", "manager"].includes(adminUser.role)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Exporting financial data requires Owner or Manager privileges" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { start_date, end_date, payment_method, payment_status } = body;

    let query = supabase
      .from("payments")
      .select(`
        id,
        order_id,
        payment_method,
        amount,
        payment_status,
        upi_reference,
        cashier_name,
        confirmed_at,
        created_at,
        orders (
          order_number,
          customer_name,
          total_amount,
          order_status
        )
      `)
      .order("confirmed_at", { ascending: false });

    if (start_date) {
      query = query.gte("confirmed_at", new Date(start_date).toISOString());
    }
    if (end_date) {
      const endD = new Date(end_date);
      endD.setHours(23, 59, 59, 999);
      query = query.lte("confirmed_at", endD.toISOString());
    }
    if (payment_method && payment_method !== "all") {
      query = query.eq("payment_method", payment_method);
    }
    if (payment_status && payment_status !== "all") {
      query = query.eq("payment_status", payment_status);
    }

    const { data: transactions, error: txErr } = await query;

    if (txErr) {
      throw new Error("Failed to fetch transactions: " + txErr.message);
    }

    // Compute totals safely on server
    let totalAmount = 0;
    let cashTotal = 0;
    let upiTotal = 0;

    const formatted = (transactions || []).map((t: any) => {
      const amt = Number(t.amount) || 0;
      totalAmount += amt;
      if (t.payment_method === "cash") cashTotal += amt;
      if (t.payment_method === "upi") upiTotal += amt;

      return {
        transaction_id: t.id,
        order_id: t.order_id,
        order_number: t.orders?.order_number || "N/A",
        customer_reference: t.orders?.customer_name || "Guest",
        payment_method: t.payment_method,
        amount: amt,
        payment_status: t.payment_status,
        upi_reference: t.upi_reference || "-",
        verified_by: t.cashier_name || "Stall Staff",
        confirmed_at: t.confirmed_at,
        created_at: t.created_at
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          count: formatted.length,
          total_amount: Math.round(totalAmount * 100) / 100,
          cash_total: Math.round(cashTotal * 100) / 100,
          upi_total: Math.round(upiTotal * 100) / 100,
          generated_at: new Date().toISOString()
        },
        transactions: formatted
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
