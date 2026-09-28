"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { listProducts } from "@/services/catalog";
import { inventoryMovement, listInventory } from "@/services/operations";
import { formatDateTime, friendlyError } from "@/lib/utils";

export default function InventoryPage() {
  const { user } = useAuth();
  const orgId = user?.organization.id;
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState("");
  const [type, setType] = useState("IN");
  const [qty, setQty] = useState("1");
  const { data: products } = useQuery({
    queryKey: ["admin-products", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listProducts(orgId!),
  });
  const { data: movements } = useQuery({
    queryKey: ["inventory", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listInventory(orgId!),
  });

  async function save() {
    try {
      await inventoryMovement({ product_id: productId, type, quantity: Number(qty) });
      toast.success("Estoque atualizado.");
      queryClient.invalidateQueries();
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível movimentar o estoque."));
    }
  }

  return (
    <AppShell>
      <AdminNav />
      <h1 className="mb-4 text-2xl font-bold">Estoque</h1>
      <div className="mb-4 grid gap-2 md:grid-cols-4">
        <select className="h-10 rounded-md border bg-background px-3" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Produto</option>
          {(products ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.stock_qty})
            </option>
          ))}
        </select>
        <select className="h-10 rounded-md border bg-background px-3" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="IN">Entrada</option>
          <option value="OUT">Saída</option>
          <option value="ADJUSTMENT">Ajuste</option>
        </select>
        <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
        <Button onClick={save}>Registrar</Button>
      </div>
      <div className="space-y-2">
        {(movements ?? []).map((m) => (
          <Card key={m.id}>
            <CardContent className="flex justify-between p-4 text-sm">
              <span>
                {m.type} · {m.quantity}
              </span>
              <span className="text-muted-foreground">{formatDateTime(m.created_at)}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
