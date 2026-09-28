"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { listSales } from "@/services/operations";
import { formatCurrency, formatDateTime, startOfDayISO } from "@/lib/utils";

export default function SalesPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["sales", user?.organization.id],
    enabled: Boolean(user),
    queryFn: () => listSales(user!.organization.id, startOfDayISO(new Date(Date.now() - 7 * 86400000)), new Date().toISOString()),
  });

  return (
    <AppShell>
      <AdminNav />
      <h1 className="mb-4 text-2xl font-bold">Vendas</h1>
      <div className="space-y-2">
        {(data ?? []).map((sale) => (
          <Card key={sale.id}>
            <CardContent className="flex items-center justify-between p-4 text-sm">
              <div>{formatDateTime(sale.created_at)}</div>
              <div className="font-semibold">{formatCurrency(sale.total)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
