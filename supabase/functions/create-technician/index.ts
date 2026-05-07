// Admin-only: creates a new technician (or manager) user
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Apenas administradores podem cadastrar técnicos" }, 403);

    const body = await req.json();
    const { email, password, full_name, phone, role = "technician" } = body ?? {};
    if (!email || !password) return json({ error: "E-mail e senha são obrigatórios" }, 400);
    if (!["technician", "manager", "admin"].includes(role)) return json({ error: "Papel inválido" }, 400);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });
    if (createErr) return json({ error: createErr.message }, 400);
    const newId = created.user!.id;

    // Trigger handles role + profile, but force-update with provided values to be safe
    await admin.from("profiles").upsert({ id: newId, full_name: full_name ?? email, phone: phone ?? null });
    // Replace any role assigned by trigger with the requested one
    await admin.from("user_roles").delete().eq("user_id", newId);
    await admin.from("user_roles").insert({ user_id: newId, role });

    return json({ ok: true, user_id: newId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
