import { audit, assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN", "MANAGER", "WAITER"]);
    const { order_id, reason } = await req.json();
    const { data: order } = await admin
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .eq("organization_id", profile.organization_id)
      .single();
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.status === "CANCELLED") throw new Error("Este pedido já foi cancelado.");
    if (order.status === "DELIVERED") throw new Error("Este pedido já foi finalizado.");

    await admin.from("orders").update({ status: "CANCELLED" }).eq("id", order.id);
    await admin.from("kitchen_tickets").update({ status: "CANCELLED" }).eq("order_id", order.id);
    const { data: items } = await admin.from("order_items").select("*").eq("order_id", order.id);
    for (const item of items ?? []) {
      const { data: product } = await admin.from("products").select("*").eq("id", item.product_id).single();
      if (product?.control_stock) {
        await admin
          .from("products")
          .update({ stock_qty: Number(product.stock_qty) + Number(item.quantity) })
          .eq("id", product.id);
        await admin.from("inventory_movements").insert({
          organization_id: profile.organization_id,
          product_id: product.id,
          user_id: profile.id,
          type: "CANCELLATION",
          quantity: item.quantity,
          notes: reason ?? `Cancelamento pedido #${order.number}`,
        });
      }
    }
    await audit(admin, profile.organization_id, profile.id, "cancel", "order", order.id, { reason });
    return json({ ok: true });
  }),
);
