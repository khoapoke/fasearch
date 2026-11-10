import type { NextRequest } from "next/server";
import { authCookie, authError, readJsonObject, requireJsonPost } from "@/lib/server/customer-auth";
import { adminIdentity, BE } from "@/lib/server/admin-bff";

/** Phân quyền vai trò Quản lý: chỉ Quản trị viên. BE kiểm tra lại (hasRole ADMIN) ở mọi yêu cầu. */
const PATH = "/api/v1/auth/roles/STAFF/permissions";
const CODE = /^[A-Z_]{1,64}$/;

async function forward(request: NextRequest, path: string, method: "GET" | "PUT", body?: unknown): Promise<Response> {
  const who = await adminIdentity(request); if ("response" in who) return who.response;
  if (who.identity.role !== "ADMIN") return authError("Chỉ Quản trị viên hệ thống được xem và sửa phân quyền.", 403, "ADMIN_REQUIRED");
  const token = authCookie(request); if (!token) return authError("Thiếu phiên quản trị.", 401, "AUTH_REQUIRED");
  try {
    const upstream = await fetch(`${BE}${path}`, { method, headers: { accept: "application/json", authorization: `Bearer ${token}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), cache: "no-store", redirect: "manual", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
    const h = new Headers({ "cache-control": "no-store" }); const t = upstream.headers.get("content-type"); if (t) h.set("content-type", t);
    return new Response(upstream.body, { status: upstream.status, headers: h });
  } catch {
    return authError("Không kết nối được máy chủ phân quyền.", 503, "PERMISSIONS_UNAVAILABLE");
  }
}

export function getStaffPermissions(request: NextRequest): Promise<Response> { return forward(request, PATH, "GET"); }
export function getStaffPermissionAudit(request: NextRequest): Promise<Response> { return forward(request, `${PATH}/audit`, "GET"); }
export async function putStaffPermissions(request: NextRequest): Promise<Response> {
  const guard = requireJsonPost(request); if (guard) return guard;
  const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response;
  const list = parsed.body.permissions;
  if (!Array.isArray(list) || list.length > 200 || !list.every((c) => typeof c === "string" && CODE.test(c))) return authError("Danh sách quyền chưa hợp lệ.", 400, "INVALID_PERMISSIONS");
  return forward(request, PATH, "PUT", { permissions: list });
}
