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
import { getSupabase } from "@/lib/supabase/client";
import { listTables } from "@/services/operations";
import { TABLE_STATUS_LABEL } from "@/lib/constants";
import { friendlyError } from "@/lib/utils";

export default function TablesAdminPage() {
  const { user } = useAuth();
  const orgId = user?.organization.id;
  const queryClient = useQueryClient();
  const [number, setNumber] = useState("16");
  const [capacity, setCapacity] = useState("4");
  const [sector, setSector] = useState("Salão");
  const { data } = useQuery({
    queryKey: ["tables-admin", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listTables(orgId!),
  });

  async function save() {
    try {
      const { error } = await getSupabase().from("tables").insert({
        organization_id: orgId,
        number: Number(number),
        name: `Mesa ${number}`,
        capacity: Number(capacity),
        sector,
        status: "FREE",
        sort_order: Number(number),
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["tables-admin", orgId] });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  return (
    <AppShell>
      <AdminNav />
      <h1 className="mb-4 text-2xl font-bold">Mesas</h1>
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Número" />
        <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Capacidade" />
        <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Setor" />
        <Button onClick={save}>Adicionar</Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((table) => (
          <Card key={table.id}>
            <CardContent className="p-4">
              <div className="font-semibold">Mesa {table.number}</div>
              <div className="text-sm text-muted-foreground">
                {table.capacity} lugares · {table.sector} · {TABLE_STATUS_LABEL[table.status]}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
