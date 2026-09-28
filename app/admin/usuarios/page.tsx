"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [saving, setSaving] = useState(false);

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
    if (!form.full_name.trim()) {
      toast.error("Informe o nome completo.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await createUser({ ...form, full_name: form.full_name.trim(), email: form.email.trim() });
      toast.success("Usuário criado.");
      setForm({ full_name: "", email: "", password: "", phone: "", primary_role: "WAITER" });
      queryClient.invalidateQueries({ queryKey: ["users", orgId] });
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível criar o usuário."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <AdminNav />
      <h1 className="mb-4 text-2xl font-bold">Usuários</h1>
      <div className="mb-6 rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-semibold">Novo usuário</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Nome completo</Label>
            <Input
              placeholder="Ex: Maria Silva"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input
              type="email"
              placeholder="usuario@restaurante.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Senha</Label>
            <Input
              placeholder="Mínimo de 6 caracteres"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Telefone</Label>
            <Input
              placeholder="Opcional"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Função</Label>
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-3"
              value={form.primary_role}
              onChange={(e) => setForm({ ...form, primary_role: e.target.value as UserRole })}
            >
              {Object.entries(ROLE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button className="mt-3" onClick={save} disabled={saving}>
          {saving ? "Criando..." : "Criar usuário"}
        </Button>
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
