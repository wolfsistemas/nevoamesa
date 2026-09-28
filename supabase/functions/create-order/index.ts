import { audit, assertRole, handle, requireUser } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";
import { notifyKitchen } from "../_shared/push.ts";

type ItemInput = {
  product_id: string;
  quantity: number;
  notes?: string;
  addons?: Array<{ name: string; price: number }>;
};

Deno.serve(
  handle(async (req) => {
    const { profile, roles, admin } = await requireUser(req);
    assertRole(roles, ["OWNER", "ADMIN", "MANAGER", "WAITER"]);
    const body = await req.json();
    const tableId = String(body.table_id ?? "");
    const items = (body.items ?? []) as ItemInput[];
    if (!tableId || !items.length) throw new Error("Informe a mesa e ao menos um item.");

    const orgId = profile.organization_id;
    const { data: table, error: tableError } = await admin
      .from("tables")
      .select("*")
      .eq("id", tableId)
      .eq("organization_id", orgId)
      .single();
    if (tableError || !table) throw new Error("Mesa não encontrada.");
    if (table.status === "UNAVAILABLE") throw new Error("Mesa indisponível.");

    let attendanceId = body.attendance_id as string | undefined;
    if (attendanceId) {
      const { data: existing } = await admin
        .from("attendances")
        .select("id, status")
        .eq("id", attendanceId)
        .eq("organization_id", orgId)
        .single();
      if (!existing || existing.status === "CLOSED" || existing.status === "CANCELLED") {
        throw new Error("Este atendimento já foi finalizado.");
      }
    } else {
      const { data: open } = await admin
        .from("attendances")
        .select("id")
        .eq("table_id", tableId)
        .in("status", ["OPEN", "WAITING_PAYMENT"])
        .maybeSingle();
      if (open) attendanceId = open.id;
      else {
        const { data: created, error } = await admin
          .from("attendances")
          .insert({
            organization_id: orgId,
            table_id: tableId,
            waiter_id: profile.id,
            status: "OPEN",
          })
          .select("id")
          .single();
        if (error || !created) throw new Error("Não foi possível abrir o atendimento.");
        attendanceId = created.id;
      }
    }

    const productIds = items.map((i) => i.product_id);
    const { data: products } = await admin
      .from("products")
      .select("*")
      .eq("organization_id", orgId)
      .in("id", productIds);
    const productMap = new Map((products ?? []).map((p) => [p.id, p]));
    const { data: settings } = await admin
      .from("organization_settings")
      .select("allow_negative_stock")
      .eq("organization_id", orgId)
      .single();

    const { data: lastOrder } = await admin
      .from("orders")
      .select("number")
      .eq("organization_id", orgId)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const number = (lastOrder?.number ?? 1000) + 1;

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        organization_id: orgId,
        attendance_id: attendanceId,
        table_id: tableId,
        waiter_id: profile.id,
        number,
        status: "SENT",
        notes: body.notes ?? null,
        sent_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (orderError || !order) throw new Error("Não foi possível criar o pedido.");

    let subtotal = 0;
    const sectorIds = new Set<string>();
    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product || !product.active) throw new Error("Produto inválido.");
      if (product.control_stock) {
        const nextQty = Number(product.stock_qty) - item.quantity;
        if (nextQty < 0 && !settings?.allow_negative_stock) {
          throw new Error(`Estoque insuficiente para ${product.name}.`);
        }
        await admin.from("products").update({ stock_qty: nextQty }).eq("id", product.id);
        await admin.from("inventory_movements").insert({
          organization_id: orgId,
          product_id: product.id,
          user_id: profile.id,
          type: "SALE",
          quantity: item.quantity,
          notes: `Pedido #${number}`,
        });
      }
      const addonTotal = (item.addons ?? []).reduce((acc, a) => acc + Number(a.price), 0);
      subtotal += (Number(product.price) + addonTotal) * item.quantity;
      const { data: orderItem, error: itemError } = await admin
        .from("order_items")
        .insert({
          organization_id: orgId,
          order_id: order.id,
          product_id: product.id,
          name: product.name,
          quantity: item.quantity,
          unit_price: product.price,
          notes: item.notes ?? null,
        })
        .select("id")
        .single();
      if (itemError || !orderItem) throw new Error("Não foi possível lançar os itens.");
      if (item.addons?.length) {
        await admin.from("order_item_addons").insert(
          item.addons.map((addon) => ({
            organization_id: orgId,
            order_item_id: orderItem.id,
            name: addon.name,
            price: addon.price,
          })),
        );
      }
      if (product.kitchen_sector_id) sectorIds.add(product.kitchen_sector_id);
    }

    if (sectorIds.size === 0) {
      await admin.from("kitchen_tickets").insert({
        organization_id: orgId,
        order_id: order.id,
        status: "NEW",
      });
    } else {
      await admin.from("kitchen_tickets").insert(
        Array.from(sectorIds).map((sectorId) => ({
          organization_id: orgId,
          order_id: order.id,
          sector_id: sectorId,
          status: "NEW",
        })),
      );
    }

    await admin.from("tables").update({ status: "OCCUPIED" }).eq("id", tableId);
    const { data: att } = await admin.from("attendances").select("subtotal").eq("id", attendanceId).single();
    const nextSubtotal = Number(att?.subtotal ?? 0) + subtotal;
    await admin
      .from("attendances")
      .update({ subtotal: nextSubtotal, total: nextSubtotal, status: "OPEN" })
      .eq("id", attendanceId);

    await audit(admin, orgId, profile.id, "create", "order", order.id, { number, tableId });
    await notifyKitchen(
      admin,
      orgId,
      `Pedido #${number}`,
      `Mesa ${table.number} — novo ticket na cozinha.`,
      order.id,
    );
    return json({ order, attendance_id: attendanceId });
  }),
);
