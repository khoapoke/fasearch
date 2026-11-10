export type PermissionItem = { code: string; label: string; enabled: boolean };
export type PermissionGroup = { code: string; label: string; permissions: PermissionItem[] };
export type RolePermissions = { role: string; editable: boolean; enabled: string[]; groups: PermissionGroup[] };
export type PermissionAudit = { id: number; actorAccountId: number | null; actorUsername: string | null; changedAt: string; added: string[]; removed: string[] };
type Envelope<T> = { success?: boolean; message?: string; result?: T };
async function parse<T>(r: Response): Promise<T> {
  let j: Envelope<T> | null = null; try { j = await r.json(); } catch {}
  if (!r.ok || j?.success !== true || j.result === undefined) throw new Error(j?.message || (r.status === 403 ? "Chỉ Quản trị viên hệ thống được sửa phân quyền." : "Không tải được phân quyền."));
  return j.result;
}
export const getStaffPermissions = async (signal?: AbortSignal) => parse<RolePermissions>(await fetch("/api/admin/role-permissions", { cache: "no-store", signal }));
export const getStaffPermissionAudit = async (signal?: AbortSignal) => parse<PermissionAudit[]>(await fetch("/api/admin/role-permissions/audit", { cache: "no-store", signal }));
export const saveStaffPermissions = async (permissions: string[]) => parse<RolePermissions>(await fetch("/api/admin/role-permissions", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ permissions }) }));
