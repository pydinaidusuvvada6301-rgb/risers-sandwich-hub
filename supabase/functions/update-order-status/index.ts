// Supabase Edge Function: update-order-status
// Runtime: Deno / TypeScript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  received: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: []
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

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id, full_name, role, is_active")
      .eq("id", user.id)
      .single();

    if (!adminUser || !adminUser.is_active) {
      return new Response(JSON.stringify({ error: "Active staff authorization required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { order_id, new_status, cancel_reason } = await req.json();

    if (!order_id || !new_status) {
      return new Response(JSON.stringify({ error: "Order ID and new status are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Role-specific action restrictions:
    // Kitchen staff can advance received -> preparing, preparing -> ready
    // Cashier, Manager, Owner can also mark completed or cancelled
    if (adminUser.role === "kitchen" && !["preparing", "ready"].includes(new_status)) {
      return new Response(JSON.stringify({ error: "Kitchen staff may only update status to 'preparing' or 'ready'" }), {
        status: 403,
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

    const allowed = VALID_TRANSITIONS[order.order_status] || [];
    if (!allowed.includes(new_status)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid transition from '${order.order_status}' to '${new_status}'. Allowed: ${allowed.join(", ") || "none"}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updatePayload: Record<string, any> = {
      order_status: new_status,
      updated_at: new Date().toISOString()
    };

    if (new_status === "cancelled") {
      updatePayload.cancelled_reason = cancel_reason || "Cancelled by staff";
    }

    const { data: updatedOrder, error: updateErr } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", order_id)
      .select()
      .single();

    if (updateErr) {
      throw new Error("Failed to update status: " + updateErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        order: updatedOrder
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
