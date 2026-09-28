import { audit, assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN", "MANAGER", "WAITER"]);
    const { attendance_id, target_table_id } = await req.json();
    const orgId = profile.organization_id;
    const { data: attendance } = await admin
      .from("attendances")
      .select("*")
      .eq("id", attendance_id)
      .eq("organization_id", orgId)
      .single();
    if (!attendance || attendance.status === "CLOSED") throw new Error("Atendimento inválido.");
    const { data: target } = await admin
      .from("tables")
      .select("*")
      .eq("id", target_table_id)
      .eq("organization_id", orgId)
      .single();
    if (!target || target.status !== "FREE") throw new Error("A mesa de destino não está livre.");

    await admin.from("tables").update({ status: "FREE" }).eq("id", attendance.table_id);
    await admin.from("tables").update({ status: "OCCUPIED" }).eq("id", target.id);
    await admin.from("attendances").update({ table_id: target.id }).eq("id", attendance.id);
    await admin.from("orders").update({ table_id: target.id }).eq("attendance_id", attendance.id);
    await audit(admin, orgId, profile.id, "update", "attendance", attendance.id, {
      from: attendance.table_id,
      to: target.id,
    });
    return json({ ok: true });
  }),
);
