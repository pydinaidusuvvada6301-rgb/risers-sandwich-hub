// Supabase Edge Function: admin-operations
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

    const { data: callerProfile } = await supabase
      .from("admin_users")
      .select("id, full_name, role, is_active")
      .eq("id", user.id)
      .single();

    if (!callerProfile || !callerProfile.is_active) {
      return new Response(JSON.stringify({ error: "Active staff authorization required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { action, payload } = body;

    // Dispatch by action
    switch (action) {
      case "close_cash_session": {
        if (!["owner", "manager", "cashier"].includes(callerProfile.role)) {
          return new Response(JSON.stringify({ error: "Insufficient permission" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const { session_id, actual_closing_cash, notes } = payload;
        const { data: session, error: sErr } = await supabase
          .from("daily_cash_sessions")
          .select("*")
          .eq("id", session_id)
          .single();

        if (sErr || !session) {
          return new Response(JSON.stringify({ error: "Session not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const expected = Number(session.opening_cash) + Number(session.cash_collections) - Number(session.cash_refunds) - Number(session.cash_expenses);
        const actual = Number(actual_closing_cash) || 0;
        const diff = Math.round((actual - expected) * 100) / 100;

        const { data: updated, error: uErr } = await supabase
          .from("daily_cash_sessions")
          .update({
            expected_closing_cash: Math.round(expected * 100) / 100,
            actual_closing_cash: actual,
            cash_difference: diff,
            status: "closed",
            closed_by: callerProfile.id,
            closed_at: new Date().toISOString(),
            notes: notes || session.notes
          })
          .eq("id", session_id)
          .select()
          .single();

        if (uErr) throw new Error("Failed to close session: " + uErr.message);

        return new Response(JSON.stringify({ success: true, session: updated }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "update_settings": {
        if (callerProfile.role !== "owner") {
          return new Response(JSON.stringify({ error: "Only Owner can modify business settings" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const { data: updated, error: setErr } = await supabase
          .from("business_settings")
          .update(payload)
          .eq("id", "stall_config")
          .select()
          .single();

        if (setErr) throw new Error("Failed to update settings: " + setErr.message);

        return new Response(JSON.stringify({ success: true, settings: updated }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
