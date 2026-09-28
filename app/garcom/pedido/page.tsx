"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingState } from "@/components/ui/empty-state";
import { getSupabase } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { Order } from "@/types";

function OrderPageInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("orders")
        .select("*, items:order_items(*, addons:order_item_addons(*)), table:tables(*), waiter:profiles(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Order;
    },
  });

  return (
    <AppShell>
      {isLoading || !data ? (
        <LoadingState />
      ) : (
        <div className="mx-auto max-w-xl space-y-4">
          <h1 className="text-2xl font-bold">Pedido #{data.number}</h1>
          <p className="text-sm text-muted-foreground">
            Mesa {data.table?.number} · {data.status}
          </p>
          <div className="rounded-xl border border-border bg-surface p-4">
            {(data.items ?? []).map((item) => (
              <div key={item.id} className="mb-3">
                <div className="font-medium">
                  {item.quantity}x {item.name} · {formatCurrency(item.unit_price)}
                </div>
                {(item.addons ?? []).map((addon) => (
                  <div key={addon.id} className="text-sm text-muted-foreground">
                    + {addon.name}
                  </div>
                ))}
                {item.notes ? <div className="text-sm text-primary">{item.notes}</div> : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <LoadingState />
        </AppShell>
      }
    >
      <OrderPageInner />
    </Suspense>
  );
}
