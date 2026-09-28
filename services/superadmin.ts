import { invokeFunction } from "@/services/edge";
import type { Organization, PlatformOrganization, Profile, Sale, Subscription } from "@/types";

export async function superadminOverview() {
  return invokeFunction<Record<string, unknown>, { organizations: PlatformOrganization[] }>("superadmin", {
    action: "overview",
  });
}

export async function superadminOrgDetail(organizationId: string) {
  return invokeFunction<
    Record<string, unknown>,
    {
      organization: Organization;
      subscription: Subscription | null;
      users: Profile[];
      sales: Sale[];
      stats: { users: number; tables: number; orders: number; sales_total: number };
    }
  >("superadmin", { action: "org_detail", organization_id: organizationId });
}

export async function superadminSetPlan(organizationId: string, planCode: string) {
  return invokeFunction("superadmin", { action: "set_plan", organization_id: organizationId, plan_code: planCode });
}

export async function superadminSetActive(organizationId: string, active: boolean) {
  return invokeFunction("superadmin", { action: "set_active", organization_id: organizationId, active });
}

export async function superadminResetPassword(userId: string, password: string) {
  return invokeFunction("superadmin", { action: "reset_password", user_id: userId, password });
}

export async function superadminImpersonate(organizationId: string) {
  return invokeFunction<Record<string, unknown>, { session: { access_token: string; refresh_token: string } }>(
    "superadmin",
    { action: "impersonate", organization_id: organizationId },
  );
}

export async function superadminAudit() {
  return invokeFunction<Record<string, unknown>, { logs: Array<Record<string, unknown>> }>("superadmin", {
    action: "audit",
  });
}
