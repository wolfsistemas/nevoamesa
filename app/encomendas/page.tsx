"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime";
import { listCategories, listProducts } from "@/services/catalog";
import { createOrder, listChannelAttendances, updateDeliveryStatus } from "@/services/operations";
import {
  CHANNEL_LABEL,
  DELIVERY_STATUS_CLASS,
  DELIVERY_STATUS_LABEL,
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABEL,
} from "@/lib/constants";
import { aggregateOrderStatus } from "@/lib/orders";
import { formatCurrency, friendlyError } from "@/lib/utils";
import type { DeliveryStatus, OrderChannel } from "@/types";

const CHANNELS: OrderChannel[] = ["BALCAO", "DELIVERY", "WHATSAPP", "ENCOMENDA"];
const OPEN_CHANNELS = ["BALCAO", "DELIVERY", "WHATSAPP", "ENCOMENDA", "ONLINE"];

type Tab = "novo" | "andamento" | "delivery";

export default function OrdersChannelPage() {
  const { user } = useAuth();
  const orgId = user?.organization.id;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("novo");
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState<OrderChannel>("BALCAO");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [scheduledFor, setScheduledFor] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["channel-attendances", orgId] });
  }, [queryClient, orgId]);

  useRealtimeTable("attendances", orgId, refresh);
  useRealtimeTable("orders", orgId, refresh);

  const { data: products } = useQuery({
    queryKey: ["products", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listProducts(orgId!, true),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listCategories(orgId!),
  });
  const { data: attendances, isLoading } = useQuery({
    queryKey: ["channel-attendances", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listChannelAttendances(orgId!, OPEN_CHANNELS),
  });

  const filtered = useMemo(() => {
    return (products ?? []).filter((p) => {
      const matchCat = categoryId === "all" || p.category_id === categoryId;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, categoryId, search]);

  const cartTotal = useMemo(() => {
    return Object.entries(cart).reduce((acc, [id, qty]) => {
      const product = (products ?? []).find((p) => p.id === id);
      return acc + (product ? Number(product.price) * qty : 0);
    }, 0);
  }, [cart, products]);

  function changeQty(id: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  function resetForm() {
    setCustomerName("");
    setCustomerPhone("");
    setAddress("");
    setDeliveryFee(0);
    setScheduledFor("");
    setNotes("");
    setCart({});
  }

  async function submit() {
    if (!Object.keys(cart).length) {
      toast.error("Adicione ao menos um item.");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    if (channel === "DELIVERY" && !address.trim()) {
      toast.error("Informe o endereço de entrega.");
      return;
    }
    setSending(true);
    try {
      await createOrder({
        channel,
        table_id: null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        delivery_address: channel === "DELIVERY" ? address.trim() : undefined,
        delivery_fee: channel === "DELIVERY" ? deliveryFee : 0,
        scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
        notes: notes.trim() || undefined,
        items: Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity })),
      });
      toast.success("Pedido enviado para a cozinha.");
      resetForm();
      refresh();
      setTab("andamento");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível criar o pedido."));
    } finally {
      setSending(false);
    }
  }

  async function advanceDelivery(attendanceId: string, current: DeliveryStatus | null) {
    const next: DeliveryStatus = current === "PENDING" ? "OUT_FOR_DELIVERY" : "DELIVERED";
    try {
      await updateDeliveryStatus(attendanceId, next);
      toast.success(`Delivery: ${DELIVERY_STATUS_LABEL[next]}`);
      refresh();
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível atualizar o delivery."));
    }
  }

  const deliveries = (attendances ?? []).filter((a) => a.channel === "DELIVERY");

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Encomendas</h1>
          <p className="text-sm text-muted-foreground">Balcão, telefone, WhatsApp e delivery</p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === "novo" ? "default" : "outline"} size="sm" onClick={() => setTab("novo")}>
            Novo pedido
          </Button>
          <Button variant={tab === "andamento" ? "default" : "outline"} size="sm" onClick={() => setTab("andamento")}>
            Em andamento
          </Button>
          <Button variant={tab === "delivery" ? "default" : "outline"} size="sm" onClick={() => setTab("delivery")}>
            Delivery
          </Button>
        </div>
      </div>

      {tab === "novo" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <Input
              placeholder="Buscar produto"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3"
            />
            <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar">
              <Button variant={categoryId === "all" ? "default" : "outline"} size="sm" onClick={() => setCategoryId("all")}>
                Todos
              </Button>
              {(categories ?? []).map((cat) => (
                <Button
                  key={cat.id}
                  variant={categoryId === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoryId(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {filtered.map((product) => (
                <div key={product.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{product.name}</div>
                    <div className="text-sm text-muted-foreground">{formatCurrency(Number(product.price))}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => changeQty(product.id, -1)}>
                      -
                    </Button>
                    <span className="w-6 text-center">{cart[product.id] ?? 0}</span>
                    <Button size="icon" variant="outline" onClick={() => changeQty(product.id, 1)}>
                      +
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Dados do pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Canal</Label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as OrderChannel)}
                >
                  {CHANNELS.map((value) => (
                    <option key={value} value={value}>
                      {CHANNEL_LABEL[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Cliente</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome do cliente" />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Opcional" />
              </div>
              {channel === "DELIVERY" ? (
                <>
                  <div className="space-y-1">
                    <Label>Endereço de entrega</Label>
                    <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro" />
                  </div>
                  <div className="space-y-1">
                    <Label>Taxa de entrega (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(Number(e.target.value))}
                    />
                  </div>
                </>
              ) : null}
              {channel === "ENCOMENDA" ? (
                <div className="space-y-1">
                  <Label>Data/hora para retirada</Label>
                  <Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
                </div>
              ) : null}
              <div className="space-y-1">
                <Label>Observações</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                <span>Itens</span>
                <span className="font-semibold">{Object.values(cart).reduce((a, b) => a + b, 0)}</span>
              </div>
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(cartTotal + (channel === "DELIVERY" ? deliveryFee : 0))}</span>
              </div>
              <Button className="w-full" onClick={submit} disabled={sending}>
                {sending ? "Enviando..." : "Enviar para a cozinha"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "andamento" ? (
        isLoading ? (
          <LoadingState />
        ) : !(attendances ?? []).length ? (
          <EmptyState title="Nenhuma encomenda em andamento" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(attendances ?? []).map((att) => {
              const status = aggregateOrderStatus(att.orders);
              return (
                <Card key={att.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <div className="font-medium">{att.customer_name ?? CHANNEL_LABEL[att.channel]}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{CHANNEL_LABEL[att.channel]}</span>
                        {att.customer_phone ? <span>{att.customer_phone}</span> : null}
                        {status ? (
                          <span className={`rounded-full border px-2 py-0.5 font-semibold ${ORDER_STATUS_CLASS[status]}`}>
                            {ORDER_STATUS_LABEL[status]}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-primary">{formatCurrency(att.total || att.subtotal)}</span>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/caixa/fechamento/?attendance=${att.id}`}>Fechar</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : null}

      {tab === "delivery" ? (
        !deliveries.length ? (
          <EmptyState title="Nenhum delivery em andamento" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {deliveries.map((att) => {
              const status = (att.delivery_status ?? "PENDING") as DeliveryStatus;
              return (
                <Card key={att.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{att.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{att.customer_phone}</div>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${DELIVERY_STATUS_CLASS[status]}`}>
                        {DELIVERY_STATUS_LABEL[status]}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">{att.delivery_address}</div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary">{formatCurrency(att.total || att.subtotal)}</span>
                      {status !== "DELIVERED" && status !== "CANCELLED" ? (
                        <Button size="sm" onClick={() => advanceDelivery(att.id, status)}>
                          {status === "PENDING" ? "Saiu para entrega" : "Entregue"}
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : null}
    </AppShell>
  );
}
