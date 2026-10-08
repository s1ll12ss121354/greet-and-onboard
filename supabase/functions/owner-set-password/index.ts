import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "UNAUTHORIZED" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error("owner-set-password is missing required Supabase secrets");
      return json({ error: "SERVER_NOT_CONFIGURED" }, 500);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ error: "UNAUTHORIZED" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify the owner against the database, never against client-supplied role data.
    const { data: ownerProfile, error: ownerError } = await admin
      .from("profiles")
      .select("nickname")
      .eq("id", caller.id)
      .maybeSingle();
    if (ownerError) {
      console.error("owner lookup failed", ownerError.message);
      return json({ error: "OWNER_CHECK_FAILED" }, 500);
    }
    if (ownerProfile?.nickname?.trim().toLowerCase() !== "isy_hesy09") {
      return json({ error: "OWNER_ONLY" }, 403);
    }

    let body: { target_user_id?: unknown; password?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }

    const targetId = typeof body.target_user_id === "string" ? body.target_user_id : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
      return json({ error: "INVALID_TARGET" }, 400);
    }
    if (password.length < 10 || password.length > 128) {
      return json({ error: "PASSWORD_LENGTH" }, 400);
    }
    if (targetId === caller.id) {
      return json({ error: "USE_ACCOUNT_SETTINGS_FOR_OWN_PASSWORD" }, 400);
    }

    const { data: targetProfile, error: targetLookupError } = await admin
      .from("profiles")
      .select("nickname")
      .eq("id", targetId)
      .maybeSingle();
    if (targetLookupError) {
      console.error("target lookup failed", targetLookupError.message);
      return json({ error: "TARGET_LOOKUP_FAILED" }, 500);
    }
    if (!targetProfile) return json({ error: "PLAYER_NOT_FOUND" }, 404);

    const { error: updateError } = await admin.auth.admin.updateUserById(targetId, { password });
    if (updateError) {
      console.error("password update failed", updateError.message);
      return json({ error: "PASSWORD_UPDATE_FAILED" }, 500);
    }

    const { error: logError } = await admin.from("activity_logs").insert({
      user_id: caller.id,
      event_type: "owner_password_changed",
      path: "/admin",
      details: { target_user_id: targetId, target_nickname: targetProfile.nickname },
    });
    if (logError) console.error("password-change audit log failed", logError.message);

    // Never log or return the password.
    return json({ ok: true });
  } catch (error) {
    console.error("owner-set-password unexpected error", error instanceof Error ? error.message : "unknown");
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
