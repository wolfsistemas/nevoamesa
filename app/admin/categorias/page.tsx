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
import { listCategories } from "@/services/catalog";
import { friendlyError } from "@/lib/utils";

export default function CategoriesPage() {
  const { user } = useAuth();
  const orgId = user?.organization.id;
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const { data } = useQuery({
    queryKey: ["categories", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listCategories(orgId!),
  });

  async function save() {
    try {
      const { error } = await getSupabase().from("categories").insert({
        organization_id: orgId,
        name,
        sort_order: (data?.length ?? 0) + 1,
      });
      if (error) throw error;
      setName("");
      queryClient.invalidateQueries({ queryKey: ["categories", orgId] });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  return (
    <AppShell>
      <AdminNav />
      <h1 className="mb-4 text-2xl font-bold">Categorias</h1>
      <div className="mb-4 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria" />
        <Button onClick={save}>Adicionar</Button>
      </div>
      <div className="space-y-2">
        {(data ?? []).map((cat) => (
          <Card key={cat.id}>
            <CardContent className="p-4">{cat.name}</CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
