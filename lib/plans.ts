import { FALLBACK_PLANS } from "@/lib/constants";
import { getSupabase } from "@/lib/supabase/client";
import type { Plan } from "@/types";

export async function listPublicPlans(): Promise<Plan[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error || !data?.length) return fallbackPlans();
    return data.map((row) => ({
      ...row,
      features: Array.isArray(row.features) ? row.features : [],
    })) as Plan[];
  } catch {
    return fallbackPlans();
  }
}

function fallbackPlans(): Plan[] {
  return FALLBACK_PLANS.map((plan, index) => ({
    id: plan.code,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    price_cents: plan.price_cents,
    currency: "BRL",
    interval: "month",
    max_users: plan.max_users,
    max_tables: plan.max_tables,
    highlighted: plan.highlighted,
    sort_order: index + 1,
    features: plan.features,
    mp_preapproval_plan_id: null,
    active: true,
  }));
}

export function planPriceLabel(plan: Pick<Plan, "price_cents" | "code">) {
  if (plan.code === "ENTERPRISE") return "Sob consulta";
  if (!plan.price_cents) return "Grátis";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    plan.price_cents / 100,
  );
}
