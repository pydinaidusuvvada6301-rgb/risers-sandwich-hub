// Supabase Edge Function: verify-admin-code
// Runtime: Deno / TypeScript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// Timing-safe comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Generate HMAC signature for gate ticket
async function signGateTicket(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const payload = JSON.stringify({
    gate_unlocked: true,
    exp: Date.now() + 15 * 60 * 1000 // 15 minutes window to login
  });
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sigHex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const b64Payload = btoa(payload);
  return `${b64Payload}.${sigHex}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const configuredCode = Deno.env.get("ADMIN_ACCESS_CODE");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!configuredCode) {
      return new Response(
        JSON.stringify({ error: "Admin access code is not configured on the server." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    // Hash IP for privacy before logging
    const ipEncoder = new TextEncoder();
    const ipData = await crypto.subtle.digest("SHA-256", ipEncoder.encode(clientIp));
    const ipHash = Array.from(new Uint8Array(ipData)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate-limiting check: count failed attempts in the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: failedCount } = await supabase
      .from("admin_access_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .eq("success", false)
      .gte("attempted_at", fifteenMinutesAgo);

    if (failedCount && failedCount >= 5) {
      return new Response(
        JSON.stringify({ 
          error: "Too many failed attempts. Security lockout active for 15 minutes. Please try again later." 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return new Response(
        JSON.stringify({ error: "Access code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isMatch = timingSafeEqual(code.trim(), configuredCode.trim());

    // Record attempt
    await supabase.from("admin_access_attempts").insert({
      ip_hash: ipHash,
      success: isMatch
    });

    if (!isMatch) {
      return new Response(
        JSON.stringify({ error: "Invalid access code. Access denied." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate short-lived gate ticket
    const gateTicket = await signGateTicket(configuredCode);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Access code verified successfully.",
        gate_ticket: gateTicket
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
