import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { json } from "./cors.ts";

export type Profile = {
  id: string;
  organization_id: string;
  primary_role: string;
  active: boolean;
  full_name: string;
  email?: string | null;
};

export async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Não autorizado");

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(url, service);

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();
  if (error || !user) throw new Error("Não autorizado");

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (profileError || !profile || !profile.active) {
    throw new Error("Perfil inativo ou não encontrado.");
  }

  const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  const roles = Array.from(
    new Set([profile.primary_role, ...((roleRows ?? []) as Array<{ role: string }>).map((r) => r.role)]),
  );

  return { user, profile: profile as Profile, roles, admin, userClient };
}

export function assertRole(roles: string[], allowed: string[]) {
  if (!roles.some((role) => allowed.includes(role))) {
    throw new Error("Você não possui permissão para esta ação.");
  }
}

export async function audit(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  action: string,
  entity: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await admin.from("audit_logs").insert({
    organization_id: orgId,
    user_id: userId,
    action,
    entity,
    entity_id: entityId,
    metadata,
  });
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" } });
    }
    try {
      return await fn(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro interno";
      const status = message.includes("autoriz") || message.includes("permissão") ? 403 : 400;
      return json({ error: message }, status);
    }
  };
}
