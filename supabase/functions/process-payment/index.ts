import { audit, assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN", "MANAGER", "CASHIER"]);
    const { attendance_id, method, amount } = await req.json();
    const value = Number(amount);
    if (!(value > 0)) throw new Error("Valor inválido.");
    const { data: payment, error } = await admin
      .from("payments")
      .insert({
        organization_id: profile.organization_id,
        attendance_id,
        method,
        amount: value,
      })
      .select("*")
      .single();
    if (error) throw error;
    await audit(admin, profile.organization_id, profile.id, "create", "payment", payment.id, { method, amount: value });
    return json({ payment });
  }),
);
