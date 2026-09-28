"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { getSupabase } from "@/lib/supabase/client";
import { listAddonGroups, listAddonItems, listProducts } from "@/services/catalog";
import { formatCurrency, friendlyError } from "@/lib/utils";

export default function AddonsPage() {
  const { user } = useAuth();
  const orgId = user?.organization.id;
  const queryClient = useQueryClient();
  const [groupName, setGroupName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("0");
  const [groupId, setGroupId] = useState("");
  const [productId, setProductId] = useState("");
  const [addonName, setAddonName] = useState("");
  const [addonPrice, setAddonPrice] = useState("0");

  const { data: groups } = useQuery({
    queryKey: ["addon-groups", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listAddonGroups(orgId!),
  });
  const { data: items } = useQuery({
    queryKey: ["addon-items", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listAddonItems(orgId!),
  });
  const { data: products } = useQuery({
    queryKey: ["admin-products", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listProducts(orgId!),
  });

  async function addGroup() {
    try {
      const { error } = await getSupabase().from("addon_groups").insert({
        organization_id: orgId,
        name: groupName,
        required: false,
        min_select: 0,
        max_select: 3,
      });
      if (error) throw error;
      setGroupName("");
      queryClient.invalidateQueries({ queryKey: ["addon-groups", orgId] });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  async function addItem() {
    try {
      const { error } = await getSupabase().from("addon_group_items").insert({
        organization_id: orgId,
        group_id: groupId,
        name: itemName,
        price: Number(itemPrice),
      });
      if (error) throw error;
      setItemName("");
      queryClient.invalidateQueries({ queryKey: ["addon-items", orgId] });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  async function addProductAddon() {
    try {
      const { error } = await getSupabase().from("product_addons").insert({
        organization_id: orgId,
        product_id: productId,
        name: addonName,
        price: Number(addonPrice),
      });
      if (error) throw error;
      toast.success("Adicional vinculado.");
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  return (
    <AppShell>
      <AdminNav />
      <h1 className="mb-4 text-2xl font-bold">Adicionais</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Grupos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ex: Ponto da carne" />
              <Button onClick={addGroup}>Criar</Button>
            </div>
            {(groups ?? []).map((g) => (
              <div key={g.id} className="rounded-lg border border-border p-3 text-sm">
                {g.name} {g.required ? "(obrigatório)" : ""}
              </div>
            ))}
            <select className="h-10 w-full rounded-md border bg-background px-3" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Item do grupo</option>
              {(groups ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Nome do item" />
            <Input value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} type="number" />
            <Button onClick={addItem}>Adicionar item</Button>
            {(items ?? []).map((item) => (
              <div key={item.id} className="text-sm">
                {item.name} · {formatCurrency(item.price)}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Adicional por produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select className="h-10 w-full rounded-md border bg-background px-3" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Produto</option>
              {(products ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Input value={addonName} onChange={(e) => setAddonName(e.target.value)} placeholder="Bacon" />
            <Input value={addonPrice} onChange={(e) => setAddonPrice(e.target.value)} type="number" />
            <Button onClick={addProductAddon}>Vincular</Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
