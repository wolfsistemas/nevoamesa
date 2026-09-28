"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { TableCard } from "@/components/garcom/table-card";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime";
import { aggregateOrderStatus } from "@/lib/orders";
import { listTables, listWaitingAttendances } from "@/services/operations";

export default function WaiterHomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orgId = user?.organization.id;

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tables", orgId] });
    queryClient.invalidateQueries({ queryKey: ["attendances", orgId] });
  }, [queryClient, orgId]);

  useRealtimeTable("tables", orgId, refresh);
  useRealtimeTable("attendances", orgId, refresh);
  useRealtimeTable("orders", orgId, refresh);

  const { data: tables, isLoading } = useQuery({
    queryKey: ["tables", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listTables(orgId!),
  });
  const { data: attendances } = useQuery({
    queryKey: ["attendances", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listWaitingAttendances(orgId!),
  });

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mesas</h1>
          <p className="text-sm text-muted-foreground">{user?.organization.name}</p>
        </div>
      </div>
      {isLoading ? (
        <LoadingState />
      ) : !tables?.length ? (
        <EmptyState title="Nenhuma mesa cadastrada" description="Peça ao administrador para criar as mesas." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {tables.map((table) => {
            const attendance = attendances?.find((a) => a.table_id === table.id);
            return (
              <TableCard
                key={table.id}
                table={table}
                attendance={attendance}
                orderStatus={aggregateOrderStatus(attendance?.orders)}
                onClick={() => router.push(`/garcom/comanda/?id=${table.id}`)}
              />
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
