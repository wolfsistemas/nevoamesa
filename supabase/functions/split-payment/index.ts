import { audit, assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN", "MANAGER", "CASHIER"]);
    const { attendance_id, parts } = await req.json();
    if (!attendance_id || !Array.isArray(parts) || !parts.length) {
      throw new Error("Informe as partes do pagamento.");
    }
    const payload = {
      attendance_id,
      payments: parts,
      discount_amount: 0,
      service_fee: 0,
    };
    const url = Deno.env.get("SUPABASE_URL")!;
    const res = await fetch(`${url}/functions/v1/close-sale`, {
      method: "POST",
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Não foi possível dividir o pagamento.");
    await audit(admin, profile.organization_id, profile.id, "split", "payment", attendance_id, { parts });
    return json(data);
  }),
);
