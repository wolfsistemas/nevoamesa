import { audit, assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN", "MANAGER", "CASHIER"]);
    const { sale_id, reason, restock } = await req.json();
    const saleId = String(sale_id ?? "");
    if (!saleId) throw new Error("Informe a venda a estornar.");

    const orgId = profile.organization_id;
    const { data: sale } = await admin
      .from("sales")
      .select("*")
      .eq("id", saleId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!sale) throw new Error("Venda não encontrada.");
    if (sale.status === "REFUNDED") throw new Error("Esta venda já foi estornada.");

    const { data: salePayments } = await admin
      .from("sale_payments")
      .select("*")
      .eq("sale_id", sale.id);
    const cashAmount = (salePayments ?? [])
      .filter((p) => p.method === "CASH")
      .reduce((acc, p) => acc + Number(p.amount), 0);

    if (cashAmount > 0) {
      const { data: register } = await admin
        .from("cash_registers")
        .select("*")
        .eq("organization_id", orgId)
        .eq("status", "OPEN")
        .maybeSingle();
      if (!register) throw new Error("Abra o caixa para registrar o estorno em dinheiro.");
      await admin.from("cash_movements").insert({
        organization_id: orgId,
        cash_register_id: register.id,
        user_id: profile.id,
        type: "REFUND",
        payment_method: "CASH",
        amount: cashAmount,
        notes: reason ?? `Estorno venda ${sale.id}`,
      });
    }

    await admin
      .from("sales")
      .update({
        status: "REFUNDED",
        refunded_at: new Date().toISOString(),
        refund_amount: Number(sale.total),
        refund_reason: reason ?? null,
      })
      .eq("id", sale.id)
      .eq("organization_id", orgId)
      .neq("status", "REFUNDED");

    await admin
      .from("payments")
      .update({ refunded_at: new Date().toISOString() })
      .eq("sale_id", sale.id);

    if (restock) {
      const { data: orders } = await admin
        .from("orders")
        .select("id, items:order_items(product_id, quantity)")
        .eq("attendance_id", sale.attendance_id)
        .neq("status", "CANCELLED");
      for (const order of orders ?? []) {
        for (const item of (order.items ?? []) as Array<{ product_id: string; quantity: number }>) {
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
              notes: `Estorno venda ${sale.id}`,
            });
          }
        }
      }
    }

    await admin
      .from("attendances")
      .update({ refunded_total: Number(sale.total) })
      .eq("id", sale.attendance_id);

    await audit(admin, orgId, profile.id, "refund", "sale", sale.id, {
      total: Number(sale.total),
      cashAmount,
      reason,
      restock: Boolean(restock),
    });
    return json({ ok: true, refunded: Number(sale.total), cash_refund: cashAmount });
  }),
);
