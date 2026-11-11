"use client";
import { useCallback } from "react";
import { useAdminIdentity } from "./admin-frame";
import { hasPermission, type PermissionCode } from "@/lib/admin-roles";

/** Role of the signed-in operator, read from the admin frame (null while the gate is not open). */
export function useAdminRole() {
  return useAdminIdentity()?.role ?? null;
}

/**
 * `can(code)`: ADMIN always true; Quản lý only for permissions switched on in "Vai trò & quyền".
 * Only hides/shows UI; the backend checks every request again.
 */
export function useAdminCan(): (code: PermissionCode) => boolean {
  const identity = useAdminIdentity();
  const role = identity?.role ?? null;
  const permissions = identity?.permissions;
  return useCallback((code: PermissionCode) => hasPermission(role, permissions, code), [role, permissions]);
}

export { canManage } from "@/lib/admin-roles";
export type { PermissionCode } from "@/lib/admin-roles";
