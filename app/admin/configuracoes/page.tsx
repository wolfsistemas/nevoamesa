"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { enablePushNotifications, disablePushNotifications } from "@/lib/push";
import { getSupabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/utils";

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({
    name: user?.organization.name ?? "",
    phone: user?.organization.phone ?? "",
    address: user?.organization.address ?? "",
    document: user?.organization.document ?? "",
    service_fee_percent: user?.settings.service_fee_percent ?? 10,
    allow_discount: user?.settings.allow_discount ?? true,
    allow_negative_stock: user?.settings.allow_negative_stock ?? false,
  });

  async function save() {
    if (!user) return;
    try {
      const supabase = getSupabase();
      const { error: orgError } = await supabase
        .from("organizations")
        .update({
          name: form.name,
          phone: form.phone,
          address: form.address,
          document: form.document,
        })
        .eq("id", user.organization.id);
      if (orgError) throw orgError;
      const { error: setError } = await supabase
        .from("organization_settings")
        .update({
          service_fee_percent: Number(form.service_fee_percent),
          allow_discount: form.allow_discount,
          allow_negative_stock: form.allow_negative_stock,
        })
        .eq("organization_id", user.organization.id);
      if (setError) throw setError;
      await refresh();
      toast.success("Configurações salvas.");
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  return (
    <AppShell>
      <AdminNav />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Configurações do restaurante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Endereço</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>CNPJ</Label>
            <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Taxa de serviço (%)</Label>
            <Input
              type="number"
              value={form.service_fee_percent}
              onChange={(e) => setForm({ ...form, service_fee_percent: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Permitir desconto</Label>
            <Switch checked={form.allow_discount} onCheckedChange={(v) => setForm({ ...form, allow_discount: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Permitir estoque negativo</Label>
            <Switch
              checked={form.allow_negative_stock}
              onCheckedChange={(v) => setForm({ ...form, allow_negative_stock: v })}
            />
          </div>
          <Button onClick={save}>Salvar</Button>
        </CardContent>
      </Card>
      <Card className="mt-4 max-w-xl">
        <CardHeader>
          <CardTitle>Notificações e impressão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ative o push para avisos da cozinha. A impressão Bluetooth é conectada na tela da cozinha.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!user) return;
                try {
                  await enablePushNotifications(user.organization.id, user.profile.id);
                  toast.success("Notificações ativadas.");
                } catch (error) {
                  toast.error(friendlyError(error, "Não foi possível ativar o push."));
                }
              }}
            >
              Ativar push
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await disablePushNotifications();
                  toast.success("Notificações desativadas.");
                } catch (error) {
                  toast.error(friendlyError(error));
                }
              }}
            >
              Desativar push
            </Button>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
