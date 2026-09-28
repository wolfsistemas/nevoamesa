"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { getSupabase } from "@/lib/supabase/client";
import { listPublicPlans, planPriceLabel } from "@/lib/plans";
import { invokeFunction } from "@/services/edge";
import { friendlyError, formatDateTime } from "@/lib/utils";
import { canManageUsers } from "@/lib/permissions";
import type { Plan, Subscription } from "@/types";

export default function SubscriptionPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const orgId = user?.organization.id;

  useEffect(() => {
    listPublicPlans().then(setPlans);
  }, []);

  const { data: subscription } = useQuery({
    queryKey: ["subscription", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, plan:plans(*)")
        .eq("organization_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data as Subscription | null;
    },
  });

  async function choosePlan(code: string) {
    setBusy(code);
    try {
      const result = await invokeFunction<
        { plan_code: string; back_url: string },
        { preview?: boolean; init_point?: string | null; message?: string }
      >("create-subscription", {
        plan_code: code,
        back_url: `${window.location.origin}/admin/assinatura/`,
      });
      await queryClient.invalidateQueries({ queryKey: ["subscription", orgId] });
      if (result.init_point) {
        window.location.href = result.init_point;
        return;
      }
      toast.success(result.message || "Plano atualizado.");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível atualizar o plano."));
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy("cancel");
    try {
      await invokeFunction("cancel-subscription", {});
      await queryClient.invalidateQueries({ queryKey: ["subscription", orgId] });
      toast.success("Assinatura cancelada.");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível cancelar."));
    } finally {
      setBusy(null);
    }
  }

  const canManage = user ? canManageUsers(user.roles) : false;
  const currentCode = subscription?.plan?.code;

  return (
    <AppShell>
      <AdminNav />
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Assinatura</h1>
        <p className="text-sm text-muted-foreground">
          Mercado Pago Assinatura pré-vinculado. Sem credenciais, o plano entra em trial.
        </p>
      </div>
      <Card className="mb-6 max-w-xl">
        <CardHeader>
          <CardTitle>Situação atual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>Plano: {subscription?.plan?.name ?? "—"}</div>
          <div>Status: {subscription?.status ?? "—"}</div>
          <div>Trial até: {formatDateTime(subscription?.trial_ends_at)}</div>
          <div>Próximo ciclo: {formatDateTime(subscription?.current_period_end)}</div>
          <div>Mercado Pago: {subscription?.mp_status ?? "não conectado"}</div>
          {canManage && subscription && subscription.status !== "canceled" ? (
            <Button className="mt-3" variant="outline" disabled={busy === "cancel"} onClick={cancel}>
              {busy === "cancel" ? "Cancelando..." : "Cancelar assinatura"}
            </Button>
          ) : null}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <Card key={plan.code} className={plan.code === currentCode ? "border-primary" : undefined}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="text-2xl font-bold">{planPriceLabel(plan)}</div>
              <p className="text-muted-foreground">{plan.description}</p>
              <ul className="space-y-1">
                {plan.features.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
              {canManage ? (
                <Button
                  className="w-full"
                  variant={plan.code === currentCode ? "outline" : "default"}
                  disabled={busy === plan.code || plan.code === currentCode}
                  onClick={() => choosePlan(plan.code)}
                >
                  {plan.code === currentCode ? "Plano atual" : busy === plan.code ? "Aguarde..." : "Assinar"}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
