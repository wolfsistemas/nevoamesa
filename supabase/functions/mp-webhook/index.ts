import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handle } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

async function verifySignature(req: Request, dataId: string) {
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secret) return true;
  const signature = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(
    signature.split(",").map((chunk) => {
      const [k, v] = chunk.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const expected = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expected.length !== v1.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return mismatch === 0;
}

Deno.serve(
  handle(async (req) => {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || url.searchParams.get("topic");
    const body = await req.json().catch(() => ({}));
    const dataId = String(body?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id") || "");
    if (!dataId) return json({ ok: true, ignored: true });

    if (!(await verifySignature(req, dataId))) {
      return json({ error: "Assinatura inválida." }, 401);
    }

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
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", orgId);
    }

    return json({ ok: true });
  }),
);
