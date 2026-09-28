import { assertRole, audit, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN"]);
    const orgId = profile.organization_id;
    const { data: sub } = await admin.from("subscriptions").select("*").eq("organization_id", orgId).maybeSingle();
    if (!sub) throw new Error("Nenhuma assinatura encontrada.");

    const token = Deno.env.get("MP_ACCESS_TOKEN");
    if (token && sub.mp_preapproval_id) {
      const res = await fetch(`https://api.mercadopago.com/preapproval/${sub.mp_preapproval_id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Não foi possível cancelar no Mercado Pago.");
      }
    }

    await admin
      .from("subscriptions")
      .update({
        status: "canceled",
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
        mp_status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
    await audit(admin, orgId, profile.id, "cancel", "subscription", sub.id, {});
    return json({ ok: true, status: "canceled" });
  }),
);
