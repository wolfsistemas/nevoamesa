import type { PaymentMethod, TableStatus, UserRole } from "@/types";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "RestaurantOS";

export const ROLE_HOME: Record<UserRole, string> = {
  OWNER: "/dashboard",
  ADMIN: "/dashboard",
  MANAGER: "/dashboard",
  CASHIER: "/caixa",
  WAITER: "/garcom",
  KITCHEN: "/cozinha",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  CASHIER: "Caixa",
  WAITER: "Garçom",
  KITCHEN: "Cozinha",
};

export const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  FREE: "Livre",
  OCCUPIED: "Ocupada",
  WAITING_PAYMENT: "Aguardando pagamento",
  RESERVED: "Reservada",
  UNAVAILABLE: "Indisponível",
};

export const TABLE_STATUS_CLASS: Record<TableStatus, string> = {
  FREE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  OCCUPIED: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  WAITING_PAYMENT: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  RESERVED: "border-violet-500/40 bg-violet-500/10 text-violet-400",
  UNAVAILABLE: "border-slate-500/40 bg-slate-500/10 text-slate-400",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX: "PIX",
  DEBIT: "Débito",
  CREDIT: "Crédito",
  OTHER: "Outros",
};

export const ADMIN_ROLES: UserRole[] = ["OWNER", "ADMIN", "MANAGER"];
export const CASH_ROLES: UserRole[] = ["OWNER", "ADMIN", "MANAGER", "CASHIER"];
export const WAITER_ROLES: UserRole[] = ["OWNER", "ADMIN", "MANAGER", "WAITER"];
export const KITCHEN_ROLES: UserRole[] = ["OWNER", "ADMIN", "MANAGER", "KITCHEN"];
