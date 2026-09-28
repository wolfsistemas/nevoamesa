import { getSupabase } from "@/lib/supabase/client";
import { invokeFunction } from "@/services/edge";
import type {
  Attendance,
  CashMovement,
  CashRegister,
  Customer,
  DiningTable,
  InventoryMovement,
  KitchenTicket,
  Order,
  PaymentMethod,
  Sale,
} from "@/types";

export async function listTables(organizationId: string) {
  const { data, error } = await getSupabase()
    .from("tables")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as DiningTable[];
}

export async function getOpenAttendance(tableId: string) {
  const { data, error } = await getSupabase()
    .from("attendances")
    .select("*, table:tables(*), waiter:profiles(*)")
    .eq("table_id", tableId)
    .in("status", ["OPEN", "WAITING_PAYMENT"])
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Attendance | null;
}

export async function listAttendanceOrders(attendanceId: string) {
  const { data, error } = await getSupabase()
    .from("orders")
    .select("*, items:order_items(*, addons:order_item_addons(*)), waiter:profiles(*), table:tables(*)")
    .eq("attendance_id", attendanceId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as Order[];
}

export async function listKitchenTickets(organizationId: string, sectorId?: string) {
  let query = getSupabase()
    .from("kitchen_tickets")
    .select(
      "*, sector:kitchen_sectors(*), order:orders(*, items:order_items(*, addons:order_item_addons(*)), waiter:profiles(*), table:tables(*))",
    )
    .eq("organization_id", organizationId)
    .in("status", ["NEW", "PREPARING", "READY"])
    .order("created_at");
  if (sectorId) query = query.eq("sector_id", sectorId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as KitchenTicket[];
}

export async function listCustomers(organizationId: string) {
  const { data, error } = await getSupabase()
    .from("customers")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Customer[];
}

export async function getOpenCashRegister(organizationId: string) {
  const { data, error } = await getSupabase()
    .from("cash_registers")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "OPEN")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as CashRegister | null;
}

export async function listCashMovements(cashRegisterId: string) {
  const { data, error } = await getSupabase()
    .from("cash_movements")
    .select("*")
    .eq("cash_register_id", cashRegisterId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CashMovement[];
}

export async function listWaitingAttendances(organizationId: string) {
  const { data, error } = await getSupabase()
    .from("attendances")
    .select("*, table:tables(*), waiter:profiles(*)")
    .eq("organization_id", organizationId)
    .in("status", ["OPEN", "WAITING_PAYMENT"])
    .order("opened_at");
  if (error) throw error;
  return (data ?? []) as Attendance[];
}

export async function listSales(organizationId: string, from: string, to: string) {
  const { data, error } = await getSupabase()
    .from("sales")
    .select("*")
    .eq("organization_id", organizationId)
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Sale[];
}

export async function listInventory(organizationId: string) {
  const { data, error } = await getSupabase()
    .from("inventory_movements")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as InventoryMovement[];
}

export async function createOrder(payload: {
  table_id: string;
  attendance_id?: string;
  notes?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    notes?: string;
    addons?: Array<{ name: string; price: number }>;
  }>;
}) {
  return invokeFunction("create-order", payload as Record<string, unknown>);
}

export async function cancelOrder(orderId: string, reason?: string) {
  return invokeFunction("cancel-order", { order_id: orderId, reason });
}

export async function transferTable(attendanceId: string, targetTableId: string) {
  return invokeFunction("transfer-table", {
    attendance_id: attendanceId,
    target_table_id: targetTableId,
  });
}

export async function openCashRegister(openingAmount: number, notes?: string) {
  return invokeFunction("open-cash-register", { opening_amount: openingAmount, notes });
}

export async function closeCashRegister(countedAmount: number, notes?: string) {
  return invokeFunction("close-cash-register", { counted_amount: countedAmount, notes });
}

export async function createCashMovement(type: string, amount: number, notes?: string) {
  return invokeFunction("cash-movement", { type, amount, notes });
}

export async function closeSale(payload: {
  attendance_id: string;
  discount_amount?: number;
  discount_percent?: number;
  service_fee?: number;
  payments: Array<{ method: PaymentMethod; amount: number }>;
  notes?: string;
}) {
  return invokeFunction("close-sale", payload);
}

export async function processPayment(payload: {
  sale_id?: string;
  attendance_id: string;
  method: PaymentMethod;
  amount: number;
}) {
  return invokeFunction("process-payment", payload);
}

export async function splitPayment(payload: {
  attendance_id: string;
  parts: Array<{ method: PaymentMethod; amount: number }>;
}) {
  return invokeFunction("split-payment", payload);
}

export async function inventoryMovement(payload: {
  product_id: string;
  type: string;
  quantity: number;
  notes?: string;
}) {
  return invokeFunction("inventory-movement", payload);
}

export async function createUser(payload: {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  primary_role: string;
}) {
  return invokeFunction("create-user", payload);
}

export async function updateKitchenTicket(id: string, status: string) {
  const patch: Record<string, unknown> = { status };
  if (status === "PREPARING") patch.accepted_at = new Date().toISOString();
  if (status === "READY") patch.ready_at = new Date().toISOString();
  const { error } = await getSupabase().from("kitchen_tickets").update(patch).eq("id", id);
  if (error) throw error;
}

export async function markOrderStatus(orderId: string, status: string) {
  const { error } = await getSupabase().from("orders").update({ status }).eq("id", orderId);
  if (error) throw error;
}

export async function requestBill(attendanceId: string) {
  const { error } = await getSupabase()
    .from("attendances")
    .update({ status: "WAITING_PAYMENT" })
    .eq("id", attendanceId)
    .eq("status", "OPEN");
  if (error) throw error;
}
