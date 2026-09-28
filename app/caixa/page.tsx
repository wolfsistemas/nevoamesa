"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { CashSummary } from "@/components/caixa/cash-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime";
import { ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from "@/lib/constants";
import { aggregateOrderStatus } from "@/lib/orders";
import { getOpenCashRegister, listCashMovements, listWaitingAttendances } from "@/services/operations";
import { formatCurrency } from "@/lib/utils";

export default function CashPage() {
  const { user } = useAuth();
  const orgId = user?.organization.id;
  const queryClient = useQueryClient();
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["cash", orgId] });
    queryClient.invalidateQueries({ queryKey: ["waiting", orgId] });
  }, [queryClient, orgId]);

  useRealtimeTable("cash_registers", orgId, refresh);
  useRealtimeTable("attendances", orgId, refresh);
  useRealtimeTable("orders", orgId, refresh);
  useRealtimeTable("sales", orgId, refresh);

  const { data: register, isLoading } = useQuery({
    queryKey: ["cash", orgId],
    enabled: Boolean(orgId),
    queryFn: () => getOpenCashRegister(orgId!),
  });
  const { data: movements } = useQuery({
    queryKey: ["cash-movements", register?.id],
    enabled: Boolean(register?.id),
    queryFn: () => listCashMovements(register!.id),
  });
  const { data: waiting } = useQuery({
    queryKey: ["waiting", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listWaitingAttendances(orgId!),
  });

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Caixa</h1>
          <p className="text-sm text-muted-foreground">
            Status: {register ? "Aberto" : "Fechado"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="flex-1 sm:flex-none">
            <Link href="/garcom/">Mesas</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1 sm:flex-none">
            <Link href="/caixa/abertura/">Abertura</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1 sm:flex-none">
            <Link href="/caixa/movimentacoes/">Movimentações</Link>
          </Button>
          <Button asChild className="flex-1 sm:flex-none">
            <Link href="/caixa/fechamento/">Fechamento</Link>
          </Button>
        </div>
      </div>
      {isLoading ? (
        <LoadingState />
      ) : !register ? (
        <EmptyState title="Caixa fechado" description="Abra o caixa para receber pagamentos." />
      ) : (
        <div className="space-y-6">
          <CashSummary register={register} movements={movements ?? []} />
          <Card>
            <CardHeader>
              <CardTitle>Atendimentos aguardando pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(waiting ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma mesa aguardando.</p>
              ) : (
                (waiting ?? []).map((att) => {
                  const status = aggregateOrderStatus(att.orders);
                  return (
                    <Link
                      key={att.id}
                      href={`/caixa/fechamento/?attendance=${att.id}`}
                      className="flex items-center justify-between rounded-lg border border-border p-3 hover:border-primary"
                    >
                      <div>
                        <div className="font-medium">
                          {att.table ? `Mesa ${att.table.number}` : att.customer_name ?? "Balcão"}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{att.status}</span>
                          {status ? (
                            <span className={`rounded-full border px-2 py-0.5 font-semibold ${ORDER_STATUS_CLASS[status]}`}>
                              {ORDER_STATUS_LABEL[status]}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="font-semibold text-primary">{formatCurrency(att.total || att.subtotal)}</div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
