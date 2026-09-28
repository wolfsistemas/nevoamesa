import type { DeliveryStatus, OrderChannel, OrderStatus, PaymentMethod, TableStatus, UserRole } from "@/types";

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

export const CHANNEL_LABEL: Record<OrderChannel, string> = {
  SALAO: "Salão",
  BALCAO: "Balcão",
  DELIVERY: "Delivery",
  WHATSAPP: "WhatsApp",
  ENCOMENDA: "Encomenda",
  ONLINE: "Cardápio online",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pendente",
  SENT: "Enviado",
  PREPARING: "Em preparo",
  READY: "Pronto",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: "border-slate-500/40 bg-slate-500/10 text-slate-400",
  SENT: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  PREPARING: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  READY: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  DELIVERED: "border-primary/40 bg-primary/10 text-primary",
  CANCELLED: "border-danger/40 bg-danger/10 text-danger",
};

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  PENDING: "Aguardando preparo",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

export const DELIVERY_STATUS_CLASS: Record<DeliveryStatus, string> = {
  PENDING: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  OUT_FOR_DELIVERY: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  DELIVERED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  CANCELLED: "border-danger/40 bg-danger/10 text-danger",
};

export const ADMIN_ROLES: UserRole[] = ["OWNER", "ADMIN", "MANAGER"];
export const CASH_ROLES: UserRole[] = ["OWNER", "ADMIN", "MANAGER", "CASHIER"];
export const WAITER_ROLES: UserRole[] = ["OWNER", "ADMIN", "MANAGER", "WAITER", "CASHIER"];
export const KITCHEN_ROLES: UserRole[] = ["OWNER", "ADMIN", "MANAGER", "KITCHEN"];

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BD5NPmfHXM91zUFSrvuT4UIJD61j1qPwWIbV0x3gfVvW_qAJmsdtvYaL8sJ555l8_UWmmlwH0yZznXKvIIukVjk";

export const LEGAL_VERSION = "2026-09";

export const FALLBACK_PLANS = [
  {
    code: "FREE",
    name: "Free",
    description: "Para testar o salão com um time pequeno.",
    price_cents: 0,
    max_users: 3,
    max_tables: 8,
    highlighted: false,
    features: ["Até 3 usuários", "Até 8 mesas", "KDS em tempo real", "Caixa básico", "Suporte por e-mail"],
  },
  {
    code: "BASIC",
    name: "Basic",
    description: "Operação diária de bares e restaurantes pequenos.",
    price_cents: 9900,
    max_users: 8,
    max_tables: 20,
    highlighted: false,
    features: [
      "Até 8 usuários",
      "Até 20 mesas",
      "Garçom, cozinha e caixa",
      "Impressão Bluetooth",
      "Notificações push",
      "14 dias de trial",
    ],
  },
  {
    code: "PRO",
    name: "Pro",
    description: "O plano completo para o salão crescer com controle.",
    price_cents: 19900,
    max_users: null as number | null,
    max_tables: null as number | null,
    highlighted: true,
    features: [
      "Usuários e mesas ilimitados",
      "Relatórios e auditoria",
      "Estoque e adicionais",
      "Push + KDS + Bluetooth",
      "Assinatura Mercado Pago",
      "Prioridade no suporte",
    ],
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    description: "Redes, múltiplas unidades e operação sob medida.",
    price_cents: 0,
    max_users: null as number | null,
    max_tables: null as number | null,
    highlighted: false,
    features: [
      "Multi-unidades",
      "SLA dedicado",
      "Onboarding assistido",
      "Integrações sob demanda",
      "Contrato personalizado",
    ],
  },
];
