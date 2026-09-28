"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { listSales } from "@/services/operations";
import { downloadCsv, formatCurrency, todayISODate } from "@/lib/utils";

export default function ReportsPage() {
  const { user } = useAuth();
  const [from, setFrom] = useState(todayISODate());
  const [to, setTo] = useState(todayISODate());
  const { data } = useQuery({
    queryKey: ["reports", user?.organization.id, from, to],
    enabled: Boolean(user),
    queryFn: () => listSales(user!.organization.id, `${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`),
  });
  const total = (data ?? []).reduce((acc, s) => acc + Number(s.total), 0);

  return (
    <AppShell>
      <AdminNav />
      <h1 className="mb-4 text-2xl font-bold">Relatórios</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button
          variant="outline"
          onClick={() =>
            downloadCsv(
              "vendas.csv",
              (data ?? []).map((s) => ({
                id: s.id,
                total: s.total,
                desconto: s.discount_amount,
                taxa: s.service_fee,
                data: s.created_at,
              })),
            )
          }
        >
          Exportar CSV
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Vendas</CardTitle>
          </CardHeader>
          <CardContent>{data?.length ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Faturamento</CardTitle>
          </CardHeader>
          <CardContent>{formatCurrency(total)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ticket médio</CardTitle>
          </CardHeader>
          <CardContent>{formatCurrency(data?.length ? total / data.length : 0)}</CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
