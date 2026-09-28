"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { ProductCard } from "@/components/garcom/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime";
import { listCategories, listProductAddons, listProducts } from "@/services/catalog";
import {
  createOrder,
  getOpenAttendance,
  listAttendanceOrders,
  listTables,
  requestBill,
  transferTable,
} from "@/services/operations";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { formatCurrency, friendlyError } from "@/lib/utils";
import type { CartAddon, CartItem, Product } from "@/types";

function ComandaPageInner() {
  const searchParams = useSearchParams();
  const tableId = searchParams.get("id") ?? "";
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orgId = user?.organization.id;
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [addonProduct, setAddonProduct] = useState<Product | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<CartAddon[]>([]);
  const [itemNotes, setItemNotes] = useState("");
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitParts, setSplitParts] = useState(2);
  const [transferOpen, setTransferOpen] = useState(false);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["attendance", tableId] });
    queryClient.invalidateQueries({ queryKey: ["attendance-orders", tableId] });
  }, [queryClient, tableId]);

  useRealtimeTable("orders", orgId, refresh);
  useRealtimeTable("attendances", orgId, refresh);
  useRealtimeTable("kitchen_tickets", orgId, refresh);

  const { data: attendance, isLoading } = useQuery({
    queryKey: ["attendance", tableId],
    queryFn: () => getOpenAttendance(tableId),
  });
  const { data: orders } = useQuery({
    queryKey: ["attendance-orders", attendance?.id],
    enabled: Boolean(attendance?.id),
    queryFn: () => listAttendanceOrders(attendance!.id),
  });
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
  const { data: addons } = useQuery({
    queryKey: ["product-addons", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listProductAddons(orgId!),
  });
  const { data: tables } = useQuery({
    queryKey: ["tables", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listTables(orgId!),
  });

  const filtered = useMemo(() => {
    return (products ?? []).filter((p) => {
      const matchCat = categoryId === "all" || p.category_id === categoryId;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, categoryId, search]);

  const cartTotal = cart.reduce(
    (acc, item) =>
      acc + (item.product.price + item.addons.reduce((s, a) => s + a.price, 0)) * item.quantity,
    0,
  );
  const currentTotal =
    (orders ?? []).reduce(
      (acc, order) =>
        acc +
        (order.items ?? []).reduce(
          (s, item) =>
            s +
            (Number(item.unit_price) + (item.addons ?? []).reduce((a, ad) => a + Number(ad.price), 0)) *
              item.quantity,
          0,
        ),
      0,
    ) + cartTotal;

  function openAdd(product: Product) {
    const productAddons = (addons ?? []).filter((a) => a.product_id === product.id);
    if (productAddons.length) {
      setAddonProduct(product);
      setSelectedAddons([]);
      setItemNotes("");
      return;
    }
    addToCart(product, [], "");
  }

  function addToCart(product: Product, itemAddons: CartAddon[], note: string) {
    setCart((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        product,
        quantity: 1,
        notes: note,
        addons: itemAddons,
      },
    ]);
    setAddonProduct(null);
  }

  const sendOrder = useCallback(async () => {
    if (!cart.length) {
      toast.error("Adicione produtos antes de enviar.");
      return;
    }
    setSending(true);
    try {
      await createOrder({
        table_id: tableId,
        attendance_id: attendance?.id,
        notes,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          notes: item.notes,
          addons: item.addons,
        })),
      });
      setCart([]);
      setNotes("");
      toast.success("Pedido enviado para a cozinha.");
      refresh();
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível enviar o pedido."));
    } finally {
      setSending(false);
    }
  }, [attendance?.id, cart, notes, refresh, tableId]);

  useHotkeys({
    Escape: () => {
      setAddonProduct(null);
      setSplitOpen(false);
      setTransferOpen(false);
    },
    F2: () => {
      document.querySelector<HTMLInputElement>("input[placeholder^='Buscar']")?.focus();
    },
    "Mod+K": () => {
      document.querySelector<HTMLInputElement>("input[placeholder^='Buscar']")?.focus();
    },
    "Mod+Enter": () => {
      void sendOrder();
    },
  });

  async function handleBill() {
    if (!attendance) {
      toast.error("Abra um atendimento antes de solicitar o fechamento.");
      return;
    }
    try {
      await requestBill(attendance.id);
      toast.success("Fechamento solicitado. O caixa já pode receber.");
      refresh();
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível solicitar o fechamento."));
    }
  }

  async function handleTransfer(targetId: string) {
    if (!attendance) return;
    try {
      await transferTable(attendance.id, targetId);
      toast.success("Mesa transferida.");
      setTransferOpen(false);
      router.push(`/garcom/comanda/?id=${targetId}`);
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível transferir a mesa."));
    }
  }

  const tableNumber = tables?.find((t) => t.id === tableId)?.number ?? attendance?.table?.number;

  if (isLoading) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mesa {tableNumber ?? ""}</h1>
          <p className="text-sm text-muted-foreground">
            {attendance ? `Aberta às ${new Date(attendance.opened_at).toLocaleTimeString("pt-BR")}` : "Novo atendimento"}
            {" · "}
            {attendance?.waiter?.full_name ?? user?.profile.full_name}
          </p>
        </div>
        <div className="text-xl font-bold text-primary">{formatCurrency(currentTotal)}</div>
      </div>

        <div className="mb-4 hidden flex-wrap gap-2 lg:flex">
        <Button onClick={sendOrder} disabled={sending}>
          {sending ? "Enviando..." : "Enviar pedido"}
        </Button>
        <Button variant="outline" onClick={() => setTransferOpen(true)} disabled={!attendance}>
          Transferir mesa
        </Button>
        <Button variant="outline" onClick={() => setSplitOpen(true)}>
          Dividir conta
        </Button>
        <Button variant="secondary" onClick={handleBill} disabled={!attendance}>
          Solicitar fechamento
        </Button>
      </div>

      <Input
        placeholder="Buscar produto (F2)"
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

      <div className="grid gap-6 pb-28 lg:grid-cols-[1fr_340px] lg:pb-0">
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={() => openAdd(product)} />
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 font-semibold">Pedido atual</h2>
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item no envio atual.</p>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.key} className="flex items-start justify-between text-sm">
                    <div>
                      <div>
                        {item.quantity}x {item.product.name}
                      </div>
                      {item.addons.map((a) => (
                        <div key={a.name} className="text-xs text-muted-foreground">
                          + {a.name}
                        </div>
                      ))}
                      {item.notes ? <div className="text-xs text-primary">{item.notes}</div> : null}
                    </div>
                    <button className="text-danger" onClick={() => setCart((c) => c.filter((i) => i.key !== item.key))}>
                      remover
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Textarea
              className="mt-3"
              placeholder="Observação do pedido"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 font-semibold">Itens enviados</h2>
            {!orders?.length ? (
              <EmptyState title="Nenhum pedido enviado" />
            ) : (
              <div className="space-y-3 text-sm">
                {orders.map((order) => (
                  <div key={order.id} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex justify-between">
                      <span className="font-medium">Pedido #{order.number}</span>
                      <span className="text-primary">{order.status}</span>
                    </div>
                    {(order.items ?? []).map((item) => (
                      <div key={item.id}>
                        {item.quantity}x {item.name}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-surface/95 p-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] backdrop-blur lg:hidden">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{cart.length} item(ns)</span>
          <span className="font-semibold text-primary">{formatCurrency(currentTotal)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={sendOrder} disabled={sending}>
            {sending ? "Enviando..." : "Enviar"}
          </Button>
          <Button variant="secondary" onClick={handleBill} disabled={!attendance}>
            Fechar conta
          </Button>
        </div>
      </div>

      <Dialog open={Boolean(addonProduct)} onOpenChange={() => setAddonProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{addonProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(addons ?? [])
              .filter((a) => a.product_id === addonProduct?.id)
              .map((addon) => {
                const checked = selectedAddons.some((s) => s.name === addon.name);
                return (
                  <label key={addon.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <span>
                      {addon.name} · {formatCurrency(Number(addon.price))}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAddons((prev) => [...prev, { name: addon.name, price: Number(addon.price) }]);
                        } else {
                          setSelectedAddons((prev) => prev.filter((s) => s.name !== addon.name));
                        }
                      }}
                    />
                  </label>
                );
              })}
            <Textarea placeholder="Ex: Sem cebola" value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} />
            <Button
              className="w-full"
              onClick={() => addonProduct && addToCart(addonProduct, selectedAddons, itemNotes)}
            >
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dividir conta</DialogTitle>
          </DialogHeader>
          <Input type="number" min={2} value={splitParts} onChange={(e) => setSplitParts(Number(e.target.value))} />
          <p className="text-sm text-muted-foreground">
            {formatCurrency(currentTotal)} / {splitParts} = {formatCurrency(currentTotal / Math.max(splitParts, 1))}
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir mesa</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {(tables ?? [])
              .filter((t) => t.id !== tableId && t.status === "FREE")
              .map((t) => (
                <Button key={t.id} variant="outline" onClick={() => handleTransfer(t.id)}>
                  Mesa {t.number}
                </Button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

export default function ComandaPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <LoadingState />
        </AppShell>
      }
    >
      <ComandaPageInner />
    </Suspense>
  );
}
