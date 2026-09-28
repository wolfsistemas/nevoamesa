import { getSupabase } from "@/lib/supabase/client";
import type { AddonGroup, AddonGroupItem, Category, KitchenSector, Product } from "@/types";

export async function listCategories(organizationId: string) {
  const { data, error } = await getSupabase()
    .from("categories")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function listKitchenSectors(organizationId: string) {
  const { data, error } = await getSupabase()
    .from("kitchen_sectors")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as KitchenSector[];
}

export async function listProducts(organizationId: string, onlyActive = false) {
  let query = getSupabase()
    .from("products")
    .select("*, category:categories(*), kitchen_sector:kitchen_sectors(*)")
    .eq("organization_id", organizationId)
    .order("sort_order");
  if (onlyActive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function listAddonGroups(organizationId: string) {
  const { data, error } = await getSupabase()
    .from("addon_groups")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as AddonGroup[];
}

export async function listAddonItems(organizationId: string) {
  const { data, error } = await getSupabase()
    .from("addon_group_items")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as AddonGroupItem[];
}

export async function listProductAddons(organizationId: string) {
  const { data, error } = await getSupabase()
    .from("product_addons")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("active", true);
  if (error) throw error;
  return data ?? [];
}
