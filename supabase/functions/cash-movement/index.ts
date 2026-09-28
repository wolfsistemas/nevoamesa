import { audit, assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN", "MANAGER", "CASHIER"]);
    const { type, amount, notes } = await req.json();
    if (!["WITHDRAWAL", "SUPPLY", "ADJUSTMENT"].includes(type)) throw new Error("Tipo inválido.");
    const value = Number(amount);
    if (!(value > 0)) throw new Error("Valor deve ser maior que zero.");
    const { data: register } = await admin
      .from("cash_registers")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("status", "OPEN")
      .maybeSingle();
    if (!register) throw new Error("Abra o caixa antes de movimentar.");
    const { data: movement, error } = await admin
      .from("cash_movements")
      .insert({
        organization_id: profile.organization_id,
        cash_register_id: register.id,
        user_id: profile.id,
        type,
        amount: value,
        notes: notes ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    await audit(admin, profile.organization_id, profile.id, type.toLowerCase(), "cash_movement", movement.id, {
      amount: value,
    });
    return json({ movement });
  }),
);
