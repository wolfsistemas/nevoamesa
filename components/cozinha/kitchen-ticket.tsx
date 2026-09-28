"use client";

import { Button } from "@/components/ui/button";
import { CHANNEL_LABEL } from "@/lib/constants";
import { elapsedLabel, formatTime } from "@/lib/utils";
import type { KitchenTicket } from "@/types";

export function KitchenTicketCard({
  ticket,
  onAdvance,
  onPrint,
}: {
  ticket: KitchenTicket;
  onAdvance: () => void;
  onPrint?: () => void;
}) {
  const order = ticket.order;
  const channel = order?.attendance?.channel;
  const origin = order?.table
    ? `Mesa ${order.table.number}`
    : channel
      ? `${CHANNEL_LABEL[channel]}${order?.attendance?.customer_name ? ` — ${order.attendance.customer_name}` : ""}`
      : "—";
  const late = Date.now() - new Date(ticket.created_at).getTime() > 12 * 60 * 1000;
  return (
    <div
      className={`rounded-xl border bg-surface p-4 shadow-soft ${late ? "border-danger" : "border-border"}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold">{origin}</div>
          <div className="text-xs text-muted-foreground">Pedido #{order?.number}</div>
        </div>
        <div className={`text-sm font-semibold ${late ? "text-danger" : "text-primary"}`}>
          {elapsedLabel(ticket.created_at)}
        </div>
      </div>
      <div className="space-y-2 text-sm">
        {(order?.items ?? []).map((item) => (
          <div key={item.id}>
            <div className="font-medium">
              {item.quantity}x {item.name}
            </div>
            {(item.addons ?? []).map((addon) => (
              <div key={addon.id} className="pl-3 text-xs text-muted-foreground">
                + {addon.name}
              </div>
            ))}
            {item.notes ? <div className="pl-3 text-xs text-primary">OBS: {item.notes}</div> : null}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{order?.waiter?.full_name ?? "Garçom"}</span>
        <span>{formatTime(ticket.created_at)}</span>
      </div>
      <div className="mt-4 flex gap-2">
        {onPrint ? (
          <Button variant="outline" className="flex-1" onClick={onPrint}>
            Imprimir
          </Button>
        ) : null}
        <Button className="flex-1" onClick={onAdvance}>
          {ticket.status === "NEW" ? "Iniciar preparo" : ticket.status === "PREPARING" ? "Marcar como pronto" : "Entregue"}
        </Button>
      </div>
    </div>
  );
}
