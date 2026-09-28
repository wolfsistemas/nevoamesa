"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { listSales, refundSale } from "@/services/operations";
import { friendlyError, formatCurrency, formatDateTime, startOfDayISO } from "@/lib/utils";
import type { Sale } from "@/types";

export default function SalesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["sales", user?.organization.id],
    enabled: Boolean(user),
    queryFn: () =>
      listSales(
        user!.organization.id,
        startOfDayISO(new Date(Date.now() - 7 * 86400000)),
        new Date().toISOString(),
      ) as Promise<Sale[]>,
  });

  const mutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => refundSale(id, reason, false),
    onSuccess: () => {
      toast.success("Venda estornada.");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (error) => toast.error(friendlyError(error, "Não foi possível estornar.")),
  });

  async function handleRefund(sale: Sale) {
    const reason = window.prompt(`Motivo do estorno da venda ${formatCurrency(sale.total)}?`, "Estorno solicitado");
    if (reason === null) return;
    setBusy(sale.id);
    try {
      await mutation.mutateAsync({ id: sale.id, reason });
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <AdminNav />
      <h1 className="mb-1 text-2xl font-bold">Vendas</h1>
      <p className="mb-4 text-sm text-muted-foreground">Estorno devolve o valor em dinheiro no caixa aberto.</p>
      <div className="space-y-2">
        {(data ?? []).map((sale) => (
          <Card key={sale.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <div>{formatDateTime(sale.created_at)}</div>
                {sale.refunded_at ? (
                  <div className="text-xs text-danger">
                    Estornada em {formatDateTime(sale.refunded_at)} · {sale.refund_reason}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{formatCurrency(sale.total)}</span>
                {sale.status === "REFUNDED" ? (
                  <Badge variant="danger">Estornada</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === sale.id}
                    onClick={() => handleRefund(sale)}
                  >
                    {busy === sale.id ? "Estornando..." : "Estornar"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
