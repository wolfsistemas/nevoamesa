import { audit, assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

type PayInput = { method: string; amount: number };

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN", "MANAGER", "CASHIER"]);
    const body = await req.json();
    const attendanceId = String(body.attendance_id ?? "");
    const payments = (body.payments ?? []) as PayInput[];
    if (!attendanceId || !payments.length) throw new Error("Informe o atendimento e os pagamentos.");

    const orgId = profile.organization_id;
    const { data: attendance } = await admin
      .from("attendances")
      .select("*")
      .eq("id", attendanceId)
      .eq("organization_id", orgId)
      .single();
    if (!attendance) throw new Error("Atendimento não encontrado.");
    if (attendance.status === "CLOSED") throw new Error("Este pedido já foi finalizado.");

    const { data: existingSale } = await admin
      .from("sales")
      .select("id")
      .eq("attendance_id", attendanceId)
      .maybeSingle();
    if (existingSale) throw new Error("Esta venda já foi registrada.");

    const { data: register } = await admin
      .from("cash_registers")
      .select("*")
      .eq("organization_id", orgId)
      .eq("status", "OPEN")
      .maybeSingle();
    if (!register) throw new Error("Abra o caixa antes de receber.");

    const { data: orders } = await admin
      .from("orders")
      .select("id, status, items:order_items(quantity, unit_price, addons:order_item_addons(price))")
      .eq("attendance_id", attendanceId)
      .neq("status", "CANCELLED");

    const subtotal = (orders ?? []).reduce((acc, order) => {
      const items = (order.items ?? []) as Array<{
        quantity: number;
        unit_price: number;
        addons?: Array<{ price: number }>;
      }>;
      return (
        acc +
        items.reduce(
          (s, item) =>
            s +
            (Number(item.unit_price) + (item.addons ?? []).reduce((a, ad) => a + Number(ad.price), 0)) *
              Number(item.quantity),
          0,
        )
      );
    }, 0);

    const discount = Number(body.discount_amount) || 0;
    const serviceFee = Number(body.service_fee) || 0;
    const total = Math.max(0, subtotal - discount + serviceFee);
    const paid = payments.reduce((acc, p) => acc + Number(p.amount), 0);
    if (Math.abs(paid - total) > 0.05) {
      throw new Error("O valor pago não confere com o total da conta.");
    }

    const { data: sale, error: saleError } = await admin
      .from("sales")
      .insert({
        organization_id: orgId,
        attendance_id: attendanceId,
        cash_register_id: register.id,
        cashier_id: profile.id,
        waiter_id: attendance.waiter_id,
        subtotal,
        discount_amount: discount,
        service_fee: serviceFee,
        total,
      })
      .select("*")
      .single();
    if (saleError || !sale) throw new Error("Não foi possível registrar a venda. Tente novamente.");

    await admin.from("sale_payments").insert(
      payments.map((p) => ({
        organization_id: orgId,
        sale_id: sale.id,
        method: p.method,
        amount: Number(p.amount),
      })),
    );
    await admin.from("payments").insert(
      payments.map((p) => ({
        organization_id: orgId,
        attendance_id: attendanceId,
        sale_id: sale.id,
        method: p.method,
        amount: Number(p.amount),
      })),
    );
    await admin.from("cash_movements").insert(
      payments.map((p) => ({
        organization_id: orgId,
        cash_register_id: register.id,
        user_id: profile.id,
        type: "SALE",
        payment_method: p.method,
        amount: Number(p.amount),
        notes: `Venda ${sale.id}`,
      })),
    );

    await admin
      .from("attendances")
      .update({
        status: "CLOSED",
        closed_at: new Date().toISOString(),
        subtotal,
        discount_amount: discount,
        service_fee: serviceFee,
        total,
        notes: body.notes ?? attendance.notes,
      })
      .eq("id", attendanceId)
      .neq("status", "CLOSED");

    await admin.from("tables").update({ status: "FREE" }).eq("id", attendance.table_id);
    await admin.from("orders").update({ status: "DELIVERED" }).eq("attendance_id", attendanceId).neq("status", "CANCELLED");
    await audit(admin, orgId, profile.id, "close", "sale", sale.id, { total, attendanceId });
    return json({ sale });
  }),
);
