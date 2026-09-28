"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { getSupabase } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import type { Order } from "@/types";

export default function OrdersAdminPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["orders-admin", user?.organization.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("orders")
        .select("*, table:tables(*)")
        .eq("organization_id", user!.organization.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Order[];
    },
  });

  return (
    <AppShell>
      <AdminNav />
      <h1 className="mb-4 text-2xl font-bold">Pedidos</h1>
      <div className="space-y-2">
        {(data ?? []).map((order) => (
          <Card key={order.id}>
            <CardContent className="flex items-center justify-between p-4 text-sm">
              <div>
                #{order.number} · Mesa {order.table?.number}
                <div className="text-muted-foreground">{formatDateTime(order.created_at)}</div>
              </div>
              <div>{order.status}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
