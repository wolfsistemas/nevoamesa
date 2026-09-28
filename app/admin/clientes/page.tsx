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
import { listCustomers } from "@/services/operations";
import { friendlyError } from "@/lib/utils";

export default function CustomersPage() {
  const { user } = useAuth();
  const orgId = user?.organization.id;
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", phone: "", email: "", document: "" });
  const { data } = useQuery({
    queryKey: ["customers", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listCustomers(orgId!),
  });

  async function save() {
    try {
      const { error } = await getSupabase().from("customers").insert({ ...form, organization_id: orgId });
      if (error) throw error;
      setForm({ name: "", phone: "", email: "", document: "" });
      queryClient.invalidateQueries({ queryKey: ["customers", orgId] });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  return (
    <AppShell>
      <AdminNav />
      <h1 className="mb-4 text-2xl font-bold">Clientes</h1>
      <div className="mb-4 grid gap-2 md:grid-cols-5">
        <Input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input placeholder="CPF" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
        <Button onClick={save}>Salvar</Button>
      </div>
      <div className="space-y-2">
        {(data ?? []).map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-muted-foreground">
                {c.phone} · {c.email}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
