import { audit, assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

const METHODS = ["CASH", "PIX", "DEBIT", "CREDIT", "OTHER"];

type PayInput = { method: string; amount: number };

function validatePayments(payments: PayInput[]) {
  if (!Array.isArray(payments) || !payments.length) {
    throw new Error("Informe ao menos uma forma de pagamento.");
  }
  for (const payment of payments) {
    if (!METHODS.includes(payment.method)) throw new Error("Forma de pagamento inválida.");
    if (!(Number(payment.amount) > 0)) throw new Error("Cada pagamento deve ter valor maior que zero.");
  }
}

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN", "MANAGER", "CASHIER"]);
    const body = await req.json();
    const attendanceId = String(body.attendance_id ?? "");
    const payments = (body.payments ?? []) as PayInput[];
    if (!attendanceId) throw new Error("Informe o atendimento.");
    validatePayments(payments);

    const orgId = profile.organization_id;
    const { data: attendance } = await admin
      .from("attendances")
      .select("*")
      .eq("id", attendanceId)
      .eq("organization_id", orgId)
      .single();
    if (!attendance) throw new Error("Atendimento não encontrado.");
    if (attendance.status === "CLOSED") throw new Error("Este atendimento já foi finalizado.");
    if (attendance.status === "CANCELLED") throw new Error("Atendimento cancelado não pode ser fechado.");

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

    const discount = Math.max(0, Number(body.discount_amount) || 0);
    const serviceFee = Math.max(0, Number(body.service_fee) || 0);
    const deliveryFee = Math.max(0, Number(attendance.delivery_fee) || 0);
    const total = Math.max(0, subtotal - Math.min(discount, subtotal) + serviceFee + deliveryFee);
    const paid = payments.reduce((acc, p) => acc + Number(p.amount), 0);
    if (Math.abs(paid - total) > 0.05) {
      throw new Error(`O valor pago (R$ ${paid.toFixed(2)}) não confere com o total (R$ ${total.toFixed(2)}).`);
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
        status: "ACTIVE",
      })
      .select("*")
      .single();
    if (saleError) {
      if (saleError.code === "23505") throw new Error("Esta venda já foi registrada.");
      throw new Error("Não foi possível registrar a venda. Tente novamente.");
    }
    if (!sale) throw new Error("Não foi possível registrar a venda. Tente novamente.");

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

    if (attendance.table_id) {
      await admin.from("tables").update({ status: "FREE" }).eq("id", attendance.table_id);
    }
    await admin
      .from("orders")
      .update({ status: "DELIVERED" })
      .eq("attendance_id", attendanceId)
      .neq("status", "CANCELLED");
    await audit(admin, orgId, profile.id, "close", "sale", sale.id, { total, attendanceId });
    return json({ sale });
  }),
);
