import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

async function assertSuperadmin(profile: { is_superadmin?: boolean }) {
  if (!profile.is_superadmin) throw new Error("Acesso restrito à administração da plataforma.");
}

async function orgStats(admin: SupabaseClient, orgId: string) {
  const [users, tables, orders, sales] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    admin.from("tables").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    admin.from("sales").select("total").eq("organization_id", orgId),
  ]);
  const salesTotal = (sales.data ?? []).reduce((acc: number, row: { total: number }) => acc + Number(row.total), 0);
  return {
    users: users.count ?? 0,
    tables: tables.count ?? 0,
    orders: orders.count ?? 0,
    sales_total: salesTotal,
  };
}

Deno.serve(
  handle(async (req) => {
    const body = await req.json();
    const action = String(body.action ?? "");

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const root = createClient(url, service);

    if (action === "bootstrap") {
      const { count } = await root
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_superadmin", true);
      if ((count ?? 0) > 0) throw new Error("Superadmin já configurado.");
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const fullName = String(body.full_name ?? "Super Admin");
      if (!email || password.length < 6) throw new Error("Informe e-mail e senha (mínimo 6 caracteres).");

      let { data: org } = await root.from("organizations").select("id").eq("slug", "plataforma-wolf").maybeSingle();
      if (!org) {
        const created = await root
          .from("organizations")
          .insert({ name: "Plataforma Wolf", slug: "plataforma-wolf", active: false })
          .select("id")
          .single();
        if (created.error || !created.data) throw new Error("Não foi possível criar a organização da plataforma.");
        org = created.data;
        await root.from("organization_settings").insert({
          organization_id: org.id,
          currency: "BRL",
          service_fee_percent: 0,
          allow_discount: false,
          allow_negative_stock: false,
          print_enabled: false,
        });
      }
      const { data: user, error } = await root.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, organization_id: org.id },
      });
      if (error || !user.user) throw new Error(error?.message ?? "Não foi possível criar o superadmin.");
      await root.from("profiles").insert({
        id: user.user.id,
        organization_id: org.id,
        full_name: fullName,
        email,
        primary_role: "OWNER",
        active: true,
        is_superadmin: true,
      });
      await root.from("user_roles").insert({
        user_id: user.user.id,
        organization_id: org.id,
        role: "OWNER",
      });
      return json({ ok: true, organization_id: org.id, user_id: user.user.id });
    }

    const { profile, admin } = await requireUser(req);
    await assertSuperadmin(profile as { is_superadmin?: boolean });

    if (action === "overview") {
      const { data: orgs } = await admin
        .from("organizations")
        .select("id, name, slug, active, created_at")
        .order("created_at", { ascending: false });
      const { data: subs } = await admin
        .from("subscriptions")
        .select("organization_id, status, plan:plans(code, name, price_cents)");
      const subMap = new Map((subs ?? []).map((s) => [s.organization_id, s]));
      const result = [];
      for (const org of orgs ?? []) {
        const sub = subMap.get(org.id) as
          | { status: string; plan: { code: string; name: string; price_cents: number } | null }
          | undefined;
        result.push({
          ...org,
          plan_code: sub?.plan?.code ?? null,
          plan_name: sub?.plan?.name ?? null,
          price_cents: sub?.plan?.price_cents ?? 0,
          subscription_status: sub?.status ?? null,
          ...(await orgStats(admin, org.id)),
        });
      }
      return json({ organizations: result });
    }

    if (action === "org_detail") {
      const orgId = String(body.organization_id ?? "");
      const { data: org } = await admin.from("organizations").select("*").eq("id", orgId).single();
      const { data: sub } = await admin
        .from("subscriptions")
        .select("*, plan:plans(*)")
        .eq("organization_id", orgId)
        .maybeSingle();
      const { data: users } = await admin
        .from("profiles")
        .select("id, full_name, email, primary_role, active, is_superadmin")
        .eq("organization_id", orgId)
        .order("full_name");
      const { data: sales } = await admin
        .from("sales")
        .select("id, total, status, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20);
      return json({ organization: org, subscription: sub, users: users ?? [], sales: sales ?? [], stats: await orgStats(admin, orgId) });
    }

    if (action === "set_plan") {
      const orgId = String(body.organization_id ?? "");
      const planCode = String(body.plan_code ?? "").toUpperCase();
      const { data: plan } = await admin.from("plans").select("*").eq("code", planCode).maybeSingle();
      if (!plan) throw new Error("Plano inválido.");
      const { data: existing } = await admin
        .from("subscriptions")
        .select("id")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (existing) {
        await admin
          .from("subscriptions")
          .update({
            plan_id: plan.id,
            status: planCode === "FREE" ? "active" : "trialing",
            cancel_at_period_end: false,
            canceled_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await admin.from("subscriptions").insert({
          organization_id: orgId,
          plan_id: plan.id,
          status: planCode === "FREE" ? "active" : "trialing",
          provider: "manual",
        });
      }
      await admin.from("platform_audit_logs").insert({
        actor_id: profile.id,
        action: "set_plan",
        target_type: "organization",
        target_id: orgId,
        metadata: { plan_code: planCode },
      });
      return json({ ok: true });
    }

    if (action === "set_active") {
      const orgId = String(body.organization_id ?? "");
      const active = Boolean(body.active);
      await admin.from("organizations").update({ active }).eq("id", orgId);
      await admin.from("platform_audit_logs").insert({
        actor_id: profile.id,
        action: active ? "activate_org" : "suspend_org",
        target_type: "organization",
        target_id: orgId,
      });
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const userId = String(body.user_id ?? "");
      const password = String(body.password ?? "");
      if (password.length < 6) throw new Error("A senha deve ter ao menos 6 caracteres.");
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw new Error(error.message);
      await admin.from("platform_audit_logs").insert({
        actor_id: profile.id,
        action: "reset_password",
        target_type: "user",
        target_id: userId,
      });
      return json({ ok: true });
    }

    if (action === "impersonate") {
      const orgId = String(body.organization_id ?? "");
      const { data: owner } = await admin
        .from("profiles")
        .select("id, email")
        .eq("organization_id", orgId)
        .eq("primary_role", "OWNER")
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (!owner?.email) throw new Error("Cliente sem usuário proprietário ativo.");
      const url = Deno.env.get("SUPABASE_URL")!;
      const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const { data: link, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: owner.email,
      });
      const tokenHash = link?.properties?.hashed_token;
      if (error || !tokenHash) throw new Error("Não foi possível gerar o acesso.");
      const verify = await fetch(`${url}/auth/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: service },
        body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
      });
      const session = await verify.json();
      if (!session?.access_token) throw new Error("Não foi possível iniciar a sessão de suporte.");
      await admin.from("platform_audit_logs").insert({
        actor_id: profile.id,
        action: "impersonate",
        target_type: "organization",
        target_id: orgId,
        metadata: { owner_email: owner.email },
      });
      return json({ session });
    }

    if (action === "audit") {
      const { data } = await admin
        .from("platform_audit_logs")
        .select("*, actor:profiles(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(100);
      return json({ logs: data ?? [] });
    }

    throw new Error("Ação desconhecida.");
  }),
);
