import type { Profile, UserRole } from "@/types";
import { ADMIN_ROLES, CASH_ROLES, KITCHEN_ROLES, WAITER_ROLES } from "@/lib/constants";

export function hasAnyRole(roles: UserRole[], allowed: UserRole[]) {
  return roles.some((role) => allowed.includes(role));
}

export function isSuperadmin(profile?: Pick<Profile, "is_superadmin"> | null) {
  return Boolean(profile?.is_superadmin);
}

export function canManageCatalog(roles: UserRole[]) {
  return hasAnyRole(roles, ADMIN_ROLES);
}

export function canOperateWaiter(roles: UserRole[]) {
  return hasAnyRole(roles, WAITER_ROLES);
}

export function canOperateKitchen(roles: UserRole[]) {
  return hasAnyRole(roles, KITCHEN_ROLES);
}

export function canOperateCash(roles: UserRole[]) {
  return hasAnyRole(roles, CASH_ROLES);
}

export function canViewReports(roles: UserRole[]) {
  return hasAnyRole(roles, ADMIN_ROLES);
}

export function canManageUsers(roles: UserRole[]) {
  return hasAnyRole(roles, ["OWNER", "ADMIN"]);
}
