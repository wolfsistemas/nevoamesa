"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { getSupabase } from "@/lib/supabase/client";
import { listCategories, listKitchenSectors, listProducts } from "@/services/catalog";
import { formatCurrency, friendlyError } from "@/lib/utils";
import type { Product } from "@/types";

const empty = {
  name: "",
  description: "",
  price: 0,
  cost: 0,
  category_id: "",
  kitchen_sector_id: "",
  active: true,
  control_stock: false,
  stock_qty: 0,
  unit: "un",
};

export default function ProductsPage() {
  const { user } = useAuth();
  const orgId = user?.organization.id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);

  const { data: products } = useQuery({
    queryKey: ["admin-products", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listProducts(orgId!),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listCategories(orgId!),
  });
  const { data: sectors } = useQuery({
    queryKey: ["sectors", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listKitchenSectors(orgId!),
  });

  function startEdit(product?: Product) {
    setEditing(product ?? null);
    setForm(
      product
        ? {
            name: product.name,
            description: product.description ?? "",
            price: product.price,
            cost: product.cost,
            category_id: product.category_id ?? "",
            kitchen_sector_id: product.kitchen_sector_id ?? "",
            active: product.active,
            control_stock: product.control_stock,
            stock_qty: product.stock_qty,
            unit: product.unit,
          }
        : empty,
    );
    setOpen(true);
  }

  async function save() {
    if (!orgId) return;
    try {
      const payload = {
        organization_id: orgId,
        name: form.name,
        description: form.description,
        price: Number(form.price),
        cost: Number(form.cost),
        category_id: form.category_id || null,
        kitchen_sector_id: form.kitchen_sector_id || null,
        active: form.active,
        control_stock: form.control_stock,
        stock_qty: Number(form.stock_qty),
        unit: form.unit,
      };
      const supabase = getSupabase();
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
      toast.success("Produto salvo.");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-products", orgId] });
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível salvar o produto."));
    }
  }

  async function deactivate(product: Product) {
    try {
      const { error } = await getSupabase().from("products").update({ active: false }).eq("id", product.id);
      if (error) throw error;
      toast.success("Produto desativado.");
      queryClient.invalidateQueries({ queryKey: ["admin-products", orgId] });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  return (
    <AppShell>
      <AdminNav />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <Button onClick={() => startEdit()}>Novo produto</Button>
      </div>
      <div className="grid gap-3">
        {(products ?? []).map((product) => (
          <Card key={product.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{product.name}</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(product)}>
                  Editar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deactivate(product)}>
                  Desativar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {formatCurrency(product.price)} · {product.active ? "Ativo" : "Inativo"} · estoque {product.stock_qty}
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Textarea
              placeholder="Descrição"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Preço"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            />
            <Input
              type="number"
              placeholder="Custo"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
            />
            <select
              className="h-10 rounded-md border border-border bg-background px-3"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            >
              <option value="">Categoria</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-border bg-background px-3"
              value={form.kitchen_sector_id}
              onChange={(e) => setForm({ ...form, kitchen_sector_id: e.target.value })}
            >
              <option value="">Setor</option>
              {(sectors ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Controla estoque</Label>
              <Switch checked={form.control_stock} onCheckedChange={(v) => setForm({ ...form, control_stock: v })} />
            </div>
            <Button onClick={save}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
