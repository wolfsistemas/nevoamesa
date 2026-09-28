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
import { createUser } from "@/services/operations";
import { ROLE_LABEL } from "@/lib/constants";
import { friendlyError } from "@/lib/utils";
import type { Profile, UserRole } from "@/types";

export default function UsersPage() {
  const { user } = useAuth();
  const orgId = user?.organization.id;
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    primary_role: "WAITER" as UserRole,
  });

  const { data } = useQuery({
    queryKey: ["users", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("profiles")
        .select("*")
        .eq("organization_id", orgId!)
        .order("full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  async function save() {
    try {
      await createUser(form);
      toast.success("Usuário criado.");
      queryClient.invalidateQueries({ queryKey: ["users", orgId] });
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível criar o usuário."));
    }
  }

  return (
    <AppShell>
      <AdminNav />
      <h1 className="mb-4 text-2xl font-bold">Usuários</h1>
      <div className="mb-6 grid gap-2 md:grid-cols-5">
        <Input placeholder="Nome" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <Input placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input placeholder="Senha" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select
          className="h-10 rounded-md border bg-background px-3"
          value={form.primary_role}
          onChange={(e) => setForm({ ...form, primary_role: e.target.value as UserRole })}
        >
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button onClick={save}>Criar</Button>
      </div>
      <div className="space-y-2">
        {(data ?? []).map((profile) => (
          <Card key={profile.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{profile.full_name}</div>
                <div className="text-sm text-muted-foreground">{profile.email}</div>
              </div>
              <div className="text-sm">{ROLE_LABEL[profile.primary_role]}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
