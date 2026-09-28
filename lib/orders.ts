import type { OrderStatus } from "@/types";

export function aggregateOrderStatus(orders?: Array<{ status: OrderStatus }>): OrderStatus | null {
  if (!orders || orders.length === 0) return null;
  const active = orders.filter((order) => order.status !== "CANCELLED");
  if (active.length === 0) return null;
  if (active.some((order) => order.status === "SENT" || order.status === "PENDING")) return "SENT";
  if (active.some((order) => order.status === "PREPARING")) return "PREPARING";
  if (active.some((order) => order.status === "READY")) return "READY";
  if (active.every((order) => order.status === "DELIVERED")) return "DELIVERED";
  return active[0]?.status ?? null;
}
