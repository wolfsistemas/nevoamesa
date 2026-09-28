import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handle } from "../_shared/auth.ts";
import { json } from "../_shared/cors.ts";
import { notifyKitchen } from "../_shared/push.ts";

type ItemInput = { product_id: string; quantity: number; notes?: string };

Deno.serve(
  handle(async (req) => {
    const body = await req.json();
    const slug = String(body.slug ?? "").trim();
    const name = String(body.customer_name ?? "").trim();
    const phone = String(body.customer_phone ?? "").trim();
    const orderType = String(body.order_type ?? "PICKUP").toUpperCase();
    const address = String(body.delivery_address ?? "").trim();
    const notes = body.notes ? String(body.notes) : null;
    const items = (body.items ?? []) as ItemInput[];

    if (!slug) throw new Error("Restaurante não informado.");
    if (!name) throw new Error("Informe o seu nome.");
    if (!items.length) throw new Error("Adicione ao menos um item.");
    if (orderType === "DELIVERY" && !address) throw new Error("Informe o endereço de entrega.");

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const { data: org } = await admin
      .from("organizations")
      .select("id, name, active")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();
    if (!org) throw new Error("Restaurante não encontrado.");

    const orgId = org.id;
    const channel = orderType === "DELIVERY" ? "DELIVERY" : "ONLINE";

    const productIds = items.map((i) => i.product_id);
    const { data: products } = await admin
      .from("products")
      .select("*")
      .eq("organization_id", orgId)
      .eq("active", true)
      .in("id", productIds);
    const productMap = new Map((products ?? []).map((p) => [p.id, p]));

    let subtotal = 0;
    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) throw new Error("Item indisponível no cardápio.");
      subtotal += Number(product.price) * Number(item.quantity);
    }

    const { data: lastOrder } = await admin
      .from("orders")
      .select("number")
      .eq("organization_id", orgId)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const number = (lastOrder?.number ?? 1000) + 1;

    const { data: customer } = await admin
      .from("customers")
      .insert({ organization_id: orgId, name, phone: phone || null })
      .select("id")
      .single();

    const { data: attendance, error: attError } = await admin
      .from("attendances")
      .insert({
        organization_id: orgId,
        table_id: null,
        waiter_id: null,
        customer_id: customer?.id ?? null,
        status: "OPEN",
        channel,
        customer_name: name,
        customer_phone: phone || null,
        delivery_address: orderType === "DELIVERY" ? address : null,
        delivery_status: orderType === "DELIVERY" ? "PENDING" : null,
        notes,
        subtotal,
        total: subtotal,
      })
      .select("id")
      .single();
    if (attError || !attendance) throw new Error("Não foi possível registrar o pedido.");

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        organization_id: orgId,
        attendance_id: attendance.id,
        table_id: null,
        waiter_id: null,
        number,
        status: "SENT",
        channel,
        notes,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (orderError || !order) throw new Error("Não foi possível registrar o pedido.");

    const sectorIds = new Set<string>();
    for (const item of items) {
      const product = productMap.get(item.product_id)!;
      const { data: orderItem } = await admin
        .from("order_items")
        .insert({
          organization_id: orgId,
          order_id: order.id,
          product_id: product.id,
          name: product.name,
          quantity: Number(item.quantity),
          unit_price: product.price,
          notes: item.notes ?? null,
        })
        .select("id")
        .single();
      if (orderItem && product.kitchen_sector_id) sectorIds.add(product.kitchen_sector_id);
    }

    if (sectorIds.size === 0) {
      await admin.from("kitchen_tickets").insert({ organization_id: orgId, order_id: order.id, status: "NEW" });
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

    await admin.from("platform_audit_logs").insert({
      action: "public_order",
      target_type: "order",
      target_id: order.id,
      metadata: { slug, number, channel },
    });

    await notifyKitchen(
      admin,
      orgId,
      `Pedido #${number}`,
      `${orderType === "DELIVERY" ? "Delivery" : "Cardápio online"} — ${name}`,
      order.id,
    );

    return json({ order_id: order.id, number, total: subtotal });
  }),
);
