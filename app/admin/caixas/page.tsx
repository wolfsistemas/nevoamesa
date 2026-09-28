"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { getSupabase } from "@/lib/supabase/client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { CashRegister } from "@/types";

export default function CashHistoryPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["cash-history", user?.organization.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("cash_registers")
        .select("*")
        .eq("organization_id", user!.organization.id)
        .order("opened_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as CashRegister[];
    },
  });

  return (
    <AppShell>
      <AdminNav />
      <h1 className="mb-4 text-2xl font-bold">Caixas</h1>
      <div className="space-y-2">
        {(data ?? []).map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between p-4 text-sm">
              <div>
                <div className="font-medium">{c.status}</div>
                <div className="text-muted-foreground">{formatDateTime(c.opened_at)}</div>
              </div>
              <div>{formatCurrency(c.opening_amount)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
