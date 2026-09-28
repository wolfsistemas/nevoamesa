import { audit, assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN", "MANAGER"]);
    const { product_id, type, quantity, notes } = await req.json();
    const qty = Number(quantity);
    if (!(qty > 0)) throw new Error("Quantidade inválida.");
    const { data: product } = await admin
      .from("products")
      .select("*")
      .eq("id", product_id)
      .eq("organization_id", profile.organization_id)
      .single();
    if (!product) throw new Error("Produto não encontrado.");
    const { data: settings } = await admin
      .from("organization_settings")
      .select("allow_negative_stock")
      .eq("organization_id", profile.organization_id)
      .single();

    let next = Number(product.stock_qty);
    if (type === "IN") next += qty;
    else if (type === "OUT") next -= qty;
    else if (type === "ADJUSTMENT") next = qty;
    else throw new Error("Tipo inválido.");

    if (next < 0 && !settings?.allow_negative_stock) {
      throw new Error("Não é permitido estoque negativo.");
    }

    await admin.from("products").update({ stock_qty: next }).eq("id", product.id);
    const { data: movement, error } = await admin
      .from("inventory_movements")
      .insert({
        organization_id: profile.organization_id,
        product_id: product.id,
        user_id: profile.id,
        type,
        quantity: qty,
        notes: notes ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    await audit(admin, profile.organization_id, profile.id, "inventory", "product", product.id, { type, qty });
    return json({ movement, stock_qty: next });
  }),
);
