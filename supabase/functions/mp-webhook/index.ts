import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handle } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

Deno.serve(
  handle(async (req) => {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || url.searchParams.get("topic");
    const body = await req.json().catch(() => ({}));
    const dataId = body?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id");
    if (!dataId) return json({ ok: true, ignored: true });

    const token = Deno.env.get("MP_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, service);

    if (!token) {
      return json({ ok: true, preview: true });
    }

    if (type === "subscription_preapproval" || type === "preapproval" || !type) {
      const res = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return json({ ok: true, skipped: true });
      const pre = await res.json();
      const orgId = pre.external_reference;
      if (!orgId) return json({ ok: true });
      const statusMap: Record<string, string> = {
        authorized: "active",
        pending: "pending",
        paused: "paused",
        cancelled: "canceled",
      };
      await admin
        .from("subscriptions")
        .update({
          mp_preapproval_id: String(pre.id),
          mp_status: pre.status,
          status: statusMap[pre.status] || pre.status,
          current_period_end: pre.next_payment_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", orgId);
    }

    return json({ ok: true });
  }),
);
