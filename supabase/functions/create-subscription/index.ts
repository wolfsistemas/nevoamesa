import { assertRole, audit, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN"]);
    const { plan_code: planCode, back_url: backUrl } = await req.json();
    if (!planCode) throw new Error("Informe o plano.");

    const { data: plan } = await admin
      .from("plans")
      .select("*")
      .eq("code", String(planCode).toUpperCase())
      .eq("active", true)
      .maybeSingle();
    if (!plan) throw new Error("Plano inválido.");

    const orgId = profile.organization_id;
    const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).single();
    const { data: existing } = await admin.from("subscriptions").select("*").eq("organization_id", orgId).maybeSingle();

    const trialEnd = new Date(Date.now() + 14 * 86400000).toISOString();
    const payload = {
      organization_id: orgId,
      plan_id: plan.id,
      billing_email: profile.email ?? null,
      provider: "mercadopago",
      updated_at: new Date().toISOString(),
    };

    if (plan.code === "FREE") {
      const row = {
        ...payload,
        status: "active",
        trial_ends_at: null,
        current_period_end: null,
        cancel_at_period_end: false,
        canceled_at: null,
      };
      if (existing) await admin.from("subscriptions").update(row).eq("id", existing.id);
      else await admin.from("subscriptions").insert(row);
      await audit(admin, orgId, profile.id, "subscribe", "subscription", existing?.id ?? null, { plan: plan.code });
      return json({ preview: true, status: "active", init_point: null });
    }

    if (plan.code === "ENTERPRISE") {
      const row = {
        ...payload,
        status: "trialing",
        trial_ends_at: trialEnd,
        current_period_end: trialEnd,
      };
      if (existing) await admin.from("subscriptions").update(row).eq("id", existing.id);
      else await admin.from("subscriptions").insert(row);
      return json({
        preview: true,
        status: "trialing",
        init_point: null,
        message: "Plano Enterprise sob consulta. Seu trial foi iniciado.",
      });
    }

    const token = Deno.env.get("MP_ACCESS_TOKEN");
    let initPoint: string | null = null;
    let preapprovalId: string | null = null;
    let mpStatus: string | null = null;

    if (token) {
      const amount = Number(plan.price_cents) / 100;
      const res = await fetch("https://api.mercadopago.com/preapproval", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: `RestaurantOS ${plan.name} — ${org?.name ?? "restaurante"}`,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: amount,
            currency_id: plan.currency || "BRL",
          },
          back_url: backUrl || "https://wolfsistemas.github.io/nevoamesa/admin/assinatura/",
          payer_email: profile.email,
          status: "pending",
          external_reference: orgId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Não foi possível iniciar a assinatura no Mercado Pago.");
      initPoint = data.init_point ?? data.sandbox_init_point ?? null;
      preapprovalId = data.id ?? null;
      mpStatus = data.status ?? "pending";
    }

    const row = {
      ...payload,
      status: token ? "pending" : "trialing",
      trial_ends_at: trialEnd,
      current_period_end: trialEnd,
      mp_preapproval_id: preapprovalId,
      mp_plan_id: plan.mp_preapproval_plan_id ?? null,
      mp_status: mpStatus,
      cancel_at_period_end: false,
      canceled_at: null,
    };
    if (existing) await admin.from("subscriptions").update(row).eq("id", existing.id);
    else await admin.from("subscriptions").insert(row);
    await audit(admin, orgId, profile.id, "subscribe", "subscription", existing?.id ?? null, {
      plan: plan.code,
      preview: !token,
    });

    return json({
      preview: !token,
      status: row.status,
      init_point: initPoint,
      message: token
        ? "Redirecione para o Mercado Pago para confirmar a assinatura."
        : "Assinatura pré-vinculada. Conecte as credenciais do Mercado Pago para cobrar de verdade.",
    });
  }),
);
