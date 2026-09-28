export type UserRole = "OWNER" | "ADMIN" | "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN";

export type TableStatus = "FREE" | "OCCUPIED" | "WAITING_PAYMENT" | "RESERVED" | "UNAVAILABLE";

export type AttendanceStatus = "OPEN" | "WAITING_PAYMENT" | "CLOSED" | "CANCELLED";

export type OrderStatus = "PENDING" | "SENT" | "PREPARING" | "READY" | "DELIVERED" | "CANCELLED";

export type KitchenTicketStatus = "NEW" | "PREPARING" | "READY" | "CANCELLED";

export type CashRegisterStatus = "OPEN" | "CLOSED";

export type PaymentMethod = "CASH" | "PIX" | "DEBIT" | "CREDIT" | "OTHER";

export type CashMovementType =
  | "OPENING"
  | "SALE"
  | "WITHDRAWAL"
  | "SUPPLY"
  | "REFUND"
  | "ADJUSTMENT"
  | "CLOSING";

export type InventoryMovementType = "IN" | "OUT" | "ADJUSTMENT" | "SALE" | "CANCELLATION";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  document: string | null;
  logo_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSettings {
  organization_id: string;
  currency: string;
  service_fee_percent: number;
  allow_discount: boolean;
  allow_negative_stock: boolean;
  print_enabled: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  primary_role: UserRole;
  active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  organization_id: string;
  role: UserRole;
}

export interface Category {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KitchenSector {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  sort_order: number;
  active: boolean;
}

export interface Product {
  id: string;
  organization_id: string;
  category_id: string | null;
  kitchen_sector_id: string | null;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  image_url: string | null;
  active: boolean;
  control_stock: boolean;
  stock_qty: number;
  unit: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category?: Category | null;
  kitchen_sector?: KitchenSector | null;
}

export interface AddonGroup {
  id: string;
  organization_id: string;
  name: string;
  required: boolean;
  min_select: number;
  max_select: number;
  active: boolean;
}

export interface AddonGroupItem {
  id: string;
  group_id: string;
  organization_id: string;
  name: string;
  price: number;
  active: boolean;
}

export interface ProductAddon {
  id: string;
  product_id: string;
  organization_id: string;
  name: string;
  price: number;
  active: boolean;
}

export interface DiningTable {
  id: string;
  organization_id: string;
  number: number;
  name: string | null;
  capacity: number;
  sector: string | null;
  status: TableStatus;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  organization_id: string;
  table_id: string;
  waiter_id: string | null;
  customer_id: string | null;
  status: AttendanceStatus;
  opened_at: string;
  closed_at: string | null;
  subtotal: number;
  discount_amount: number;
  discount_percent: number;
  service_fee: number;
  total: number;
  refunded_total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  table?: DiningTable | null;
  waiter?: Profile | null;
}

export interface Order {
  id: string;
  organization_id: string;
  attendance_id: string;
  table_id: string;
  waiter_id: string | null;
  number: number;
  status: OrderStatus;
  notes: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  table?: DiningTable | null;
  waiter?: Profile | null;
}

export interface OrderItem {
  id: string;
  organization_id: string;
  order_id: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  created_at: string;
  addons?: OrderItemAddon[];
  product?: Product | null;
}

export interface OrderItemAddon {
  id: string;
  organization_id: string;
  order_item_id: string;
  name: string;
  price: number;
}

export interface KitchenTicket {
  id: string;
  organization_id: string;
  order_id: string;
  sector_id: string | null;
  status: KitchenTicketStatus;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  order?: Order | null;
  sector?: KitchenSector | null;
}

export interface CashRegister {
  id: string;
  organization_id: string;
  opened_by: string;
  closed_by: string | null;
  status: CashRegisterStatus;
  opening_amount: number;
  closing_amount: number | null;
  expected_amount: number | null;
  difference_amount: number | null;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
}

export interface CashMovement {
  id: string;
  organization_id: string;
  cash_register_id: string;
  user_id: string;
  type: CashMovementType;
  payment_method: PaymentMethod | null;
  amount: number;
  notes: string | null;
  created_at: string;
}

export interface Sale {
  id: string;
  organization_id: string;
  attendance_id: string;
  cash_register_id: string | null;
  cashier_id: string;
  waiter_id: string | null;
  subtotal: number;
  discount_amount: number;
  service_fee: number;
  total: number;
  status: string;
  refunded_at: string | null;
  refund_amount: number;
  refund_reason: string | null;
  created_at: string;
}

export interface SalePayment {
  id: string;
  organization_id: string;
  sale_id: string;
  method: PaymentMethod;
  amount: number;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  organization_id: string;
  product_id: string;
  user_id: string | null;
  type: InventoryMovementType;
  quantity: number;
  notes: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface SessionUser {
  profile: Profile;
  organization: Organization;
  settings: OrganizationSettings;
  roles: UserRole[];
}

export interface CartAddon {
  name: string;
  price: number;
}

export interface CartItem {
  key: string;
  product: Product;
  quantity: number;
  notes: string;
  addons: CartAddon[];
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  interval: string;
  max_users: number | null;
  max_tables: number | null;
  highlighted: boolean;
  sort_order: number;
  features: string[];
  mp_preapproval_plan_id: string | null;
  active: boolean;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string | null;
  status: string;
  billing_email: string | null;
  mp_preapproval_id: string | null;
  mp_plan_id: string | null;
  mp_status: string | null;
  provider: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
  plan?: Plan | null;
}

export interface PushSubscriptionRow {
  id: string;
  organization_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  organization_id: string;
  user_id: string | null;
  title: string;
  body: string;
  type: string;
  entity: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface PrinterStation {
  id: string;
  organization_id: string;
  name: string;
  sector_id: string | null;
  connection_type: string;
  device_name: string | null;
  active: boolean;
  created_at: string;
}

export interface DashboardMetrics {
  sales_total: number;
  orders_count: number;
  ticket_average: number;
  occupied_tables: number;
  free_tables: number;
  preparing_orders: number;
  ready_orders: number;
  cash_open: boolean;
  hourly: Array<{ hour: string; total: number }>;
  daily: Array<{ day: string; total: number }>;
  top_products: Array<{ name: string; quantity: number; total: number }>;
  payments: Array<{ method: PaymentMethod; total: number }>;
}
