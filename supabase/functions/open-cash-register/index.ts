import { audit, assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN", "MANAGER", "CASHIER"]);
    const { opening_amount, notes } = await req.json();
    const orgId = profile.organization_id;
    const { data: open } = await admin
      .from("cash_registers")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "OPEN")
      .maybeSingle();
    if (open) throw new Error("Já existe um caixa aberto.");

    const { data: register, error } = await admin
      .from("cash_registers")
      .insert({
        organization_id: orgId,
        opened_by: profile.id,
        status: "OPEN",
        opening_amount: Number(opening_amount) || 0,
        notes: notes ?? null,
      })
      .select("*")
      .single();
    if (error || !register) throw new Error("Não foi possível abrir o caixa.");
    await admin.from("cash_movements").insert({
      organization_id: orgId,
      cash_register_id: register.id,
      user_id: profile.id,
      type: "OPENING",
      amount: Number(opening_amount) || 0,
      notes,
    });
    await audit(admin, orgId, profile.id, "create", "cash_register", register.id, { opening_amount });
    return json({ register });
  }),
);
