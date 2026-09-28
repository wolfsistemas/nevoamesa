import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handle } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

Deno.serve(
  handle(async (req) => {
    const body = await req.json();
    const restaurantName = String(body.restaurant_name ?? "").trim();
    const fullName = String(body.full_name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const phone = body.phone ? String(body.phone) : null;
    const planCode = String(body.plan_code ?? "FREE").toUpperCase();
    const acceptTerms = Boolean(body.accept_terms);
    const acceptPrivacy = Boolean(body.accept_privacy);

    if (!restaurantName || !fullName || !email || password.length < 6) {
      throw new Error("Informe restaurante, nome, e-mail e senha (mínimo 6 caracteres).");
    }
    if (!acceptTerms || !acceptPrivacy) {
      throw new Error("Aceite os Termos de Uso e a Política de Privacidade para continuar.");
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const { data: plan } = await admin.from("plans").select("*").eq("code", planCode).eq("active", true).maybeSingle();
    if (!plan) throw new Error("Plano inválido.");

    let slug = slugify(restaurantName) || "restaurante";
    const { data: existingSlug } = await admin.from("organizations").select("id").eq("slug", slug).maybeSingle();
    if (existingSlug) slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`;

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({
        name: restaurantName,
        slug,
        phone,
        active: true,
      })
      .select("*")
      .single();
    if (orgError || !org) throw new Error("Não foi possível criar o restaurante.");

    const { data: created, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, organization_id: org.id },
    });
    if (userError || !created.user) {
      await admin.from("organizations").delete().eq("id", org.id);
      throw new Error(userError?.message || "Não foi possível criar o usuário.");
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: created.user.id,
      organization_id: org.id,
      full_name: fullName,
      email,
      phone,
      primary_role: "OWNER",
      active: true,
    });
    if (profileError) throw profileError;

    await admin.from("user_roles").insert({
      user_id: created.user.id,
      organization_id: org.id,
      role: "OWNER",
    });
    await admin.from("organization_settings").insert({
      organization_id: org.id,
      currency: "BRL",
      service_fee_percent: 10,
      allow_discount: true,
      allow_negative_stock: false,
      print_enabled: true,
      timezone: "America/Sao_Paulo",
    });

    const trialDays = planCode === "FREE" ? 0 : 14;
    const now = new Date();
    const trialEnd = trialDays ? new Date(now.getTime() + trialDays * 86400000) : null;
    await admin.from("subscriptions").insert({
      organization_id: org.id,
      plan_id: plan.id,
      status: planCode === "FREE" ? "active" : "trialing",
      billing_email: email,
      provider: "mercadopago",
      trial_ends_at: trialEnd?.toISOString() ?? null,
      current_period_end: trialEnd?.toISOString() ?? null,
    });

    await admin.from("kitchen_sectors").insert({
      organization_id: org.id,
      name: "Cozinha",
      color: "#f59e0b",
      sort_order: 1,
      active: true,
    });

    const tableCount = Math.min(plan.max_tables ?? 8, 8);
    await admin.from("tables").insert(
      Array.from({ length: tableCount }, (_, i) => ({
        organization_id: org.id,
        number: i + 1,
        name: `Mesa ${i + 1}`,
        capacity: 4,
        sector: "Salão",
        status: "FREE",
        active: true,
        sort_order: i + 1,
      })),
    );

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? null;
    await admin.from("legal_acceptances").insert([
      {
        organization_id: org.id,
        user_id: created.user.id,
        document: "terms",
        version: "2026-09",
        ip,
      },
      {
        organization_id: org.id,
        user_id: created.user.id,
        document: "privacy",
        version: "2026-09",
        ip,
      },
    ]);

    return json({
      organization_id: org.id,
      slug,
      plan: plan.code,
      status: planCode === "FREE" ? "active" : "trialing",
    });
  }),
);
