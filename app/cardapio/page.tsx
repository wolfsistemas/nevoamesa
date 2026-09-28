"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getSupabase } from "@/lib/supabase/client";
import { createPublicOrder } from "@/services/operations";
import { formatCurrency, friendlyError } from "@/lib/utils";
import type { PublicMenu } from "@/types";

function MenuInner() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ number: number; total: number } | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await getSupabase().rpc("public_menu", { p_slug: slug });
        if (cancelled) return;
        if (error || !data) setNotFound(true);
        else setMenu(data as PublicMenu);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const cartTotal = useMemo(
    () =>
      Object.entries(cart).reduce((acc, [id, qty]) => {
        const product = menu?.products.find((p) => p.id === id);
        return acc + (product ? Number(product.price) * qty : 0);
      }, 0),
    [cart, menu],
  );

  function changeQty(id: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  async function submit() {
    if (!Object.keys(cart).length) {
      toast.error("Adicione ao menos um item.");
      return;
    }
    if (!name.trim()) {
      toast.error("Informe o seu nome.");
      return;
    }
    if (orderType === "DELIVERY" && !address.trim()) {
      toast.error("Informe o endereço de entrega.");
      return;
    }
    setSending(true);
    try {
      const result = await createPublicOrder({
        slug,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        order_type: orderType,
        delivery_address: orderType === "DELIVERY" ? address.trim() : undefined,
        notes: notes.trim() || undefined,
        items: Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity })),
      });
      setDone({ number: result.number, total: result.total });
      setCart({});
      setNotes("");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível enviar o pedido."));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-muted-foreground">Carregando cardápio...</div>;
  }

  if (notFound || !menu) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-bold">Cardápio não encontrado</h1>
        <p className="text-sm text-muted-foreground">Verifique o link recebido do restaurante.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-bold text-primary">Pedido #{done.number} confirmado!</h1>
        <p className="text-sm text-muted-foreground">
          Total {formatCurrency(done.total)} · {orderType === "DELIVERY" ? "Entrega em breve" : "Retire no balcão"}.
        </p>
        <Button onClick={() => setDone(null)}>Fazer novo pedido</Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-40">
      <header className="border-b border-border bg-surface/95 px-4 py-5 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-bold text-primary">{menu.organization.name}</h1>
          {menu.organization.address ? (
            <p className="text-sm text-muted-foreground">{menu.organization.address}</p>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {menu.categories.map((cat) => {
          const products = menu.products.filter((p) => p.category_id === cat.id);
          if (!products.length) return null;
          return (
            <section key={cat.id} className="space-y-3">
              <h2 className="text-lg font-semibold">{cat.name}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {products.map((product) => (
                  <Card key={product.id}>
                    <CardContent className="space-y-2 p-4">
                      <div className="font-medium">{product.name}</div>
                      {product.description ? (
                        <p className="text-xs text-muted-foreground">{product.description}</p>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-primary">{formatCurrency(Number(product.price))}</span>
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
        {menu.products.filter((p) => !p.category_id).length ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Outros</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {menu.products
                .filter((p) => !p.category_id)
                .map((product) => (
                  <Card key={product.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <span className="text-sm font-semibold text-primary">{formatCurrency(Number(product.price))}</span>
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
                    </CardContent>
                  </Card>
                ))}
            </div>
          </section>
        ) : null}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Seu nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp (opcional)" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={orderType === "PICKUP" ? "default" : "outline"}
              size="sm"
              onClick={() => setOrderType("PICKUP")}
            >
              Retirada
            </Button>
            <Button
              variant={orderType === "DELIVERY" ? "default" : "outline"}
              size="sm"
              onClick={() => setOrderType("DELIVERY")}
            >
              Entrega
            </Button>
          </div>
          {orderType === "DELIVERY" ? (
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Endereço de entrega" />
          ) : null}
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações (opcional)" />
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total: {formatCurrency(cartTotal)}</span>
            <Button onClick={submit} disabled={sending}>
              {sending ? "Enviando..." : "Enviar pedido"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CardapioPage() {
  return (
    <Suspense
      fallback={<div className="flex min-h-dvh items-center justify-center text-muted-foreground">Carregando...</div>}
    >
      <MenuInner />
    </Suspense>
  );
}
