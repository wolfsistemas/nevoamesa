import { audit, assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN", "MANAGER", "CASHIER"]);
    const { counted_amount, notes } = await req.json();
    const orgId = profile.organization_id;
    const { data: register } = await admin
      .from("cash_registers")
      .select("*")
      .eq("organization_id", orgId)
      .eq("status", "OPEN")
      .maybeSingle();
    if (!register) throw new Error("Nenhum caixa aberto.");

    const { data: movements } = await admin
      .from("cash_movements")
      .select("*")
      .eq("cash_register_id", register.id);
    const sum = (type: string) =>
      (movements ?? []).filter((m) => m.type === type).reduce((acc, m) => acc + Number(m.amount), 0);
    const expected = Number(register.opening_amount) + sum("SALE") + sum("SUPPLY") - sum("WITHDRAWAL") - sum("REFUND");
    const counted = Number(counted_amount) || 0;
    const { data: updated, error } = await admin
      .from("cash_registers")
      .update({
        status: "CLOSED",
        closed_by: profile.id,
        closed_at: new Date().toISOString(),
        closing_amount: counted,
        expected_amount: expected,
        difference_amount: counted - expected,
        notes: notes ?? register.notes,
      })
      .eq("id", register.id)
      .eq("status", "OPEN")
      .select("*")
      .maybeSingle();
    if (error || !updated) throw new Error("O caixa já foi fechado.");
    await admin.from("cash_movements").insert({
      organization_id: orgId,
      cash_register_id: register.id,
      user_id: profile.id,
      type: "CLOSING",
      amount: counted,
      notes,
    });
    await audit(admin, orgId, profile.id, "close", "cash_register", register.id, { expected, counted });
    return json({ register: updated });
  }),
);
