"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { KitchenTicketCard } from "@/components/cozinha/kitchen-ticket";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime";
import { connectKitchenPrinter, printKitchenTicket } from "@/lib/bluetooth-print";
import { enablePushNotifications } from "@/lib/push";
import { friendlyError } from "@/lib/utils";
import { listKitchenSectors } from "@/services/catalog";
import { listKitchenTickets, markOrderStatus, updateKitchenTicket } from "@/services/operations";
import type { KitchenTicket, KitchenTicketStatus } from "@/types";

const COLUMNS: Array<{ status: KitchenTicketStatus; title: string }> = [
  { status: "NEW", title: "Novos" },
  { status: "PREPARING", title: "Em preparo" },
  { status: "READY", title: "Prontos" },
];

export default function KitchenPage() {
  const { user } = useAuth();
  const orgId = user?.organization.id;
  const queryClient = useQueryClient();
  const [sectorId, setSectorId] = useState<string>("all");
  const [flash, setFlash] = useState(false);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const seenTickets = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["kitchen", orgId] });
    setFlash(true);
    setTimeout(() => setFlash(false), 1200);
    toast.info("Novo pedido recebido");
  }, [queryClient, orgId]);

  useRealtimeTable("kitchen_tickets", orgId, refresh);
  useRealtimeTable("orders", orgId, refresh);

  const { data: sectors } = useQuery({
    queryKey: ["sectors", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listKitchenSectors(orgId!),
  });
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["kitchen", orgId, sectorId],
    enabled: Boolean(orgId),
    queryFn: () => listKitchenTickets(orgId!, sectorId === "all" ? undefined : sectorId),
    refetchInterval: 8000,
  });

  const grouped = useMemo(() => {
    return COLUMNS.map((col) => ({
      ...col,
      items: (tickets ?? []).filter((t) => t.status === col.status),
    }));
  }, [tickets]);

  useEffect(() => {
    if (!tickets) return;
    if (!primed.current) {
      tickets.forEach((ticket) => seenTickets.current.add(ticket.id));
      primed.current = true;
      return;
    }
    const incoming = tickets.filter((ticket) => ticket.status === "NEW" && !seenTickets.current.has(ticket.id));
    incoming.forEach((ticket) => seenTickets.current.add(ticket.id));
    if (autoPrint && printerName) {
      incoming.forEach((ticket) => {
        printKitchenTicket(ticket).catch(() => undefined);
      });
    }
  }, [tickets, autoPrint, printerName]);

  async function advance(ticketId: string, current: KitchenTicketStatus, orderId?: string) {
    const next = current === "NEW" ? "PREPARING" : current === "PREPARING" ? "READY" : "READY";
    await updateKitchenTicket(ticketId, next);
    if (orderId) {
      await markOrderStatus(orderId, next === "PREPARING" ? "PREPARING" : "READY");
    }
    queryClient.invalidateQueries({ queryKey: ["kitchen", orgId] });
  }

  return (
    <div className={flash ? "animate-pulse" : undefined}>
      <AppShell>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Cozinha</h1>
            <p className="text-sm text-muted-foreground">Pedidos em tempo real</p>
          </div>
          <div className="flex flex-wrap gap-2 overflow-x-auto no-scrollbar">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const name = await connectKitchenPrinter();
                  setPrinterName(name);
                  toast.success(`Impressora: ${name}`);
                } catch (error) {
                  toast.error(friendlyError(error, "Não foi possível conectar a impressora."));
                }
              }}
            >
              {printerName ? printerName : "Bluetooth"}
            </Button>
            <Button variant={autoPrint ? "default" : "outline"} size="sm" onClick={() => setAutoPrint((v) => !v)}>
              Auto-print {autoPrint ? "on" : "off"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!user) return;
                try {
                  await enablePushNotifications(user.organization.id, user.profile.id);
                  toast.success("Push da cozinha ativado.");
                } catch (error) {
                  toast.error(friendlyError(error, "Não foi possível ativar o push."));
                }
              }}
            >
              Ativar push
            </Button>
            <Button variant={sectorId === "all" ? "default" : "outline"} size="sm" onClick={() => setSectorId("all")}>
              Todos
            </Button>
            {(sectors ?? []).map((sector) => (
              <Button
                key={sector.id}
                variant={sectorId === sector.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSectorId(sector.id)}
              >
                {sector.name}
              </Button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <LoadingState />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {grouped.map((col) => (
              <section key={col.status} className="rounded-xl border border-border bg-surface/50 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">{col.title}</h2>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs">{col.items.length}</span>
                </div>
                <div className="space-y-3">
                  {col.items.length === 0 ? (
                    <EmptyState title="Nenhum pedido" />
                  ) : (
                    col.items.map((ticket) => (
                      <KitchenTicketCard
                        key={ticket.id}
                        ticket={ticket}
                        onAdvance={() => advance(ticket.id, ticket.status, ticket.order_id)}
                        onPrint={async () => {
                          try {
                            await printKitchenTicket(ticket as KitchenTicket);
                            toast.success("Ticket enviado à impressora.");
                          } catch (error) {
                            toast.error(friendlyError(error, "Falha na impressão Bluetooth."));
                          }
                        }}
                      />
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </AppShell>
    </div>
  );
}
