import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Informe um e-mail válido"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
    confirm: z.string().min(6, "Confirme a senha"),
  })
  .refine((data) => data.password === data.confirm, {
    message: "As senhas não coincidem",
    path: ["confirm"],
  });

export const signupSchema = z.object({
  restaurant_name: z.string().min(2, "Informe o nome do restaurante"),
  full_name: z.string().min(2, "Informe o seu nome"),
  email: z.string().email("Informe um e-mail válido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  phone: z.string().optional(),
  plan_code: z.enum(["FREE", "BASIC", "PRO", "ENTERPRISE"]),
  accept_terms: z.boolean().refine((value) => value === true, {
    message: "Aceite os Termos de Uso",
  }),
  accept_privacy: z.boolean().refine((value) => value === true, {
    message: "Aceite a Política de Privacidade",
  }),
});

export const productSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  description: z.string().optional().nullable(),
  price: z.coerce.number().min(0, "Preço inválido"),
  cost: z.coerce.number().min(0).default(0),
  category_id: z.string().uuid().optional().nullable(),
  kitchen_sector_id: z.string().uuid().optional().nullable(),
  active: z.boolean().default(true),
  control_stock: z.boolean().default(false),
  stock_qty: z.coerce.number().default(0),
  unit: z.string().default("un"),
  image_url: z.string().optional().nullable(),
});

export const categorySchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  sort_order: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});

export const tableSchema = z.object({
  number: z.coerce.number().int().min(1),
  name: z.string().optional().nullable(),
  capacity: z.coerce.number().int().min(1).default(4),
  sector: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

export const customerSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  document: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const userSchema = z.object({
  full_name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional().nullable(),
  password: z.string().min(6).optional(),
  primary_role: z.enum(["OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER", "KITCHEN"]),
  active: z.boolean().default(true),
});

export const cashOpenSchema = z.object({
  opening_amount: z.coerce.number().min(0),
  notes: z.string().optional().nullable(),
});

export const cashMovementSchema = z.object({
  type: z.enum(["WITHDRAWAL", "SUPPLY", "ADJUSTMENT"]),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  notes: z.string().optional().nullable(),
});

export const cashCloseSchema = z.object({
  counted_amount: z.coerce.number().min(0),
  notes: z.string().optional().nullable(),
});

export const paymentSchema = z.object({
  method: z.enum(["CASH", "PIX", "DEBIT", "CREDIT", "OTHER"]),
  amount: z.coerce.number().positive(),
});

export const closeSaleSchema = z.object({
  attendance_id: z.string().uuid(),
  discount_amount: z.coerce.number().min(0).default(0),
  discount_percent: z.coerce.number().min(0).max(100).default(0),
  service_fee: z.coerce.number().min(0).default(0),
  payments: z.array(paymentSchema).min(1, "Informe ao menos uma forma de pagamento"),
  notes: z.string().optional().nullable(),
});

export const inventorySchema = z.object({
  product_id: z.string().uuid(),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().positive(),
  notes: z.string().optional().nullable(),
});

export const settingsSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  document: z.string().optional().nullable(),
  currency: z.string().default("BRL"),
  service_fee_percent: z.coerce.number().min(0).max(100),
  allow_discount: z.boolean(),
  allow_negative_stock: z.boolean(),
});

export const addonGroupSchema = z.object({
  name: z.string().min(2),
  required: z.boolean().default(false),
  min_select: z.coerce.number().int().min(0).default(0),
  max_select: z.coerce.number().int().min(1).default(1),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type ProductValues = z.infer<typeof productSchema>;
export type CloseSaleValues = z.infer<typeof closeSaleSchema>;
