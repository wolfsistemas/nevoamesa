import { audit, assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN", "MANAGER", "WAITER"]);
    const { order_id, reason } = await req.json();
    const orderId = String(order_id ?? "");
    if (!orderId) throw new Error("Informe o pedido a cancelar.");

    const orgId = profile.organization_id;
    const { data: order } = await admin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.status === "CANCELLED") throw new Error("Este pedido já foi cancelado.");
    if (order.status === "DELIVERED") {
      throw new Error("Pedido já finalizado. Use o estorno da venda no caixa.");
    }

    const { data: attendance } = await admin
      .from("attendances")
      .select("id, status")
      .eq("id", order.attendance_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (attendance?.status === "CLOSED") {
      throw new Error("Atendimento já pago. Use o estorno da venda no caixa.");
    }

    const { data: cancelled, error: cancelError } = await admin
      .from("orders")
      .update({ status: "CANCELLED" })
      .eq("id", order.id)
      .eq("organization_id", orgId)
      .neq("status", "CANCELLED")
      .select("id");
    if (cancelError) throw cancelError;
    if (!cancelled?.length) throw new Error("Este pedido já foi cancelado.");

    await admin.from("kitchen_tickets").update({ status: "CANCELLED" }).eq("order_id", order.id);

    const { data: items } = await admin.from("order_items").select("*").eq("order_id", order.id);
    for (const item of items ?? []) {
      const { data: product } = await admin.from("products").select("*").eq("id", item.product_id).maybeSingle();
      if (product?.control_stock) {
        await admin
          .from("products")
          .update({ stock_qty: Number(product.stock_qty) + Number(item.quantity) })
          .eq("id", product.id);
        await admin.from("inventory_movements").insert({
          organization_id: orgId,
          product_id: product.id,
          user_id: profile.id,
          type: "CANCELLATION",
          quantity: item.quantity,
          notes: reason ?? `Cancelamento pedido #${order.number}`,
        });
      }
    }

    const { data: remaining } = await admin
      .from("orders")
      .select("id, items:order_items(quantity, unit_price, addons:order_item_addons(price))")
      .eq("attendance_id", order.attendance_id)
      .neq("status", "CANCELLED");
    const subtotal = (remaining ?? []).reduce((acc, row) => {
      const rowItems = (row.items ?? []) as Array<{
        quantity: number;
        unit_price: number;
        addons?: Array<{ price: number }>;
      }>;
      return (
        acc +
        rowItems.reduce(
          (s, item) =>
            s +
            (Number(item.unit_price) + (item.addons ?? []).reduce((a, ad) => a + Number(ad.price), 0)) *
              Number(item.quantity),
          0,
        )
      );
    }, 0);

    await admin
      .from("attendances")
      .update({ subtotal, total: subtotal })
      .eq("id", order.attendance_id)
      .neq("status", "CLOSED");

    await audit(admin, orgId, profile.id, "cancel", "order", order.id, { reason, subtotal });
    return json({ ok: true, subtotal });
  }),
);
