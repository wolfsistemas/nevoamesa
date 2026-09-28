"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { getSupabase } from "@/lib/supabase/client";
import {
  superadminAudit,
  superadminImpersonate,
  superadminOrgDetail,
  superadminOverview,
  superadminResetPassword,
  superadminSetActive,
  superadminSetPlan,
} from "@/services/superadmin";
import { formatCurrency, friendlyError } from "@/lib/utils";
import type { PlatformOrganization } from "@/types";

const PLAN_OPTIONS = ["FREE", "BASIC", "PRO", "ENTERPRISE"];

export default function SuperadminPage() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"clients" | "audit">("clients");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const isSuper = Boolean(user?.profile.is_superadmin);

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "overview"],
    enabled: isSuper,
    queryFn: superadminOverview,
  });
  const { data: audit } = useQuery({
    queryKey: ["superadmin", "audit"],
    enabled: isSuper && tab === "audit",
    queryFn: superadminAudit,
  });
  const { data: detail } = useQuery({
    queryKey: ["superadmin", "detail", detailId],
    enabled: isSuper && Boolean(detailId),
    queryFn: () => superadminOrgDetail(detailId!),
  });

  const setPlan = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) => superadminSetPlan(id, plan),
    onSuccess: () => {
      toast.success("Plano atualizado.");
      queryClient.invalidateQueries({ queryKey: ["superadmin"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => superadminSetActive(id, active),
    onSuccess: () => {
      toast.success("Organização atualizada.");
      queryClient.invalidateQueries({ queryKey: ["superadmin"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  async function impersonate(org: PlatformOrganization) {
    try {
      const { session } = await superadminImpersonate(org.id);
      const { error } = await getSupabase().auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error) throw error;
      await refresh();
      toast.success(`Acessando ${org.name}`);
      router.replace("/dashboard/");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível acessar o cliente."));
    }
  }

  async function confirmReset() {
    if (!resetUser) return;
    try {
      await superadminResetPassword(resetUser.id, newPassword);
      toast.success("Senha redefinida.");
      setResetUser(null);
      setNewPassword("");
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  if (!isSuper) {
    return (
      <AppShell>
        <EmptyState title="Acesso restrito" description="Somente o superadmin da plataforma pode acessar esta área." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Superadmin</h1>
          <p className="text-sm text-muted-foreground">Clientes, planos, contas e auditoria da plataforma</p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === "clients" ? "default" : "outline"} size="sm" onClick={() => setTab("clients")}>
            Clientes
          </Button>
          <Button variant={tab === "audit" ? "default" : "outline"} size="sm" onClick={() => setTab("audit")}>
            Auditoria
          </Button>
        </div>
      </div>

      {tab === "clients" ? (
        isLoading ? (
          <LoadingState />
        ) : (
          <div className="space-y-3">
            {(data?.organizations ?? []).map((org) => (
              <Card key={org.id}>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {org.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">/{org.slug}</span>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                      value={org.plan_code ?? ""}
                      onChange={(e) => setPlan.mutate({ id: org.id, plan: e.target.value })}
                    >
                      <option value="" disabled>
                        Plano
                      </option>
                      {PLAN_OPTIONS.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant={org.active ? "destructive" : "default"}
                      onClick={() => setActive.mutate({ id: org.id, active: !org.active })}
                    >
                      {org.active ? "Suspender" : "Reativar"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => impersonate(org)}>
                      Acessar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDetailId(detailId === org.id ? null : org.id)}>
                      Detalhes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Plano: <strong className="text-foreground">{org.plan_name ?? "—"}</strong></span>
                  <span>Assinatura: <strong className="text-foreground">{org.subscription_status ?? "—"}</strong></span>
                  <span>Valor: <strong className="text-foreground">{formatCurrency(org.price_cents / 100)}</strong></span>
                  <span>Usuários: <strong className="text-foreground">{org.users}</strong></span>
                  <span>Mesas: <strong className="text-foreground">{org.tables}</strong></span>
                  <span>Pedidos: <strong className="text-foreground">{org.orders}</strong></span>
                  <span>Vendas: <strong className="text-foreground">{formatCurrency(org.sales_total)}</strong></span>
                  <span className={org.active ? "text-emerald-400" : "text-danger"}>
                    {org.active ? "Ativa" : "Suspensa"}
                  </span>
                </CardContent>
                {detailId === org.id && detail ? (
                  <CardContent className="space-y-3 border-t border-border pt-4">
                    <div>
                      <div className="mb-2 text-sm font-semibold">Usuários</div>
                      <div className="space-y-1">
                        {detail.users.map((profile) => (
                          <div key={profile.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                            <div>
                              <div className="font-medium">{profile.full_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {profile.email} · {profile.primary_role}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setResetUser({ id: profile.id, name: profile.full_name })}
                            >
                              Redefinir senha
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-sm font-semibold">Últimas vendas</div>
                      {detail.sales.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhuma venda.</p>
                      ) : (
                        <div className="space-y-1 text-sm">
                          {detail.sales.map((sale) => (
                            <div key={sale.id} className="flex justify-between">
                              <span>{new Date(sale.created_at).toLocaleString("pt-BR")}</span>
                              <span>{formatCurrency(sale.total)} · {sale.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {(audit?.logs ?? []).map((log) => (
            <Card key={String(log.id)}>
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <div>
                  <div className="font-medium">{String(log.action)}</div>
                  <div className="text-xs text-muted-foreground">
                    {log.actor ? `${(log.actor as { full_name?: string }).full_name ?? ""}` : "—"} ·{" "}
                    {new Date(String(log.created_at)).toLocaleString("pt-BR")}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{String(log.target_type ?? "")}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(resetUser)} onOpenChange={() => setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha de {resetUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
              />
            </div>
            <Button className="w-full" onClick={confirmReset} disabled={newPassword.length < 6}>
              Redefinir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
