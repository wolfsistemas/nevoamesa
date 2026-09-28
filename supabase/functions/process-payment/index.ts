import { audit, assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

const METHODS = ["CASH", "PIX", "DEBIT", "CREDIT", "OTHER"];

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN", "MANAGER", "CASHIER"]);
    const { attendance_id, method, amount } = await req.json();
    const attendanceId = String(attendance_id ?? "");
    const value = Number(amount);
    if (!attendanceId) throw new Error("Informe o atendimento.");
    if (!METHODS.includes(method)) throw new Error("Forma de pagamento inválida.");
    if (!(value > 0)) throw new Error("Valor inválido.");

    const { data: attendance } = await admin
      .from("attendances")
      .select("id, status")
      .eq("id", attendanceId)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();
    if (!attendance) throw new Error("Atendimento não encontrado.");
    if (attendance.status === "CLOSED" || attendance.status === "CANCELLED") {
      throw new Error("Atendimento não está aberto para pagamento.");
    }

    const { data: existingSale } = await admin
      .from("sales")
      .select("id")
      .eq("attendance_id", attendanceId)
      .maybeSingle();
    if (existingSale) throw new Error("Atendimento já foi fechado. Use o caixa para receber.");

    const { data: payment, error } = await admin
      .from("payments")
      .insert({
        organization_id: profile.organization_id,
        attendance_id: attendanceId,
        method,
        amount: value,
      })
      .select("*")
      .single();
    if (error) throw error;
    await audit(admin, profile.organization_id, profile.id, "create", "payment", payment.id, {
      method,
      amount: value,
    });
    return json({ payment });
  }),
);
