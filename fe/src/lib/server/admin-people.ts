import type { NextRequest } from "next/server";
import { authCookie, authError, readJsonObject, requireJsonPost } from "@/lib/server/customer-auth";
import { adminIdentity, BE } from "@/lib/server/admin-bff";
const ROLES = new Set(["STAFF", "ADMIN"]);
const STATUSES = new Set(["ACTIVE", "INACTIVE", "LOCKED"]);
const GENDERS = new Set(["MALE", "FEMALE", "OTHER"]);
const PHONE = /^(0|\+84)[0-9]{9}$/;
const CCCD = /^[0-9]{12}$/;
function out(upstream: Response): Response { const h = new Headers({ "cache-control": "no-store" }); const t = upstream.headers.get("content-type"); if (t) h.set("content-type", t); return new Response(upstream.body, { status: upstream.status, headers: h }); }
async function ctx(request: NextRequest, adminOnly = true): Promise<{ token: string; id: number; role: string } | { response: Response }> {
  const who = await adminIdentity(request); if ("response" in who) return { response: who.response };
  if (adminOnly && who.identity.role !== "ADMIN") return { response: authError("Chỉ Quản trị viên hệ thống được quản lý tài khoản và vai trò.", 403, "ADMIN_REQUIRED") };
  const token = authCookie(request); if (!token) return { response: authError("Thiếu phiên quản trị.", 401, "AUTH_REQUIRED") };
  return { token, id: who.identity.id, role: who.identity.role };
}
async function forward(request: NextRequest, path: string, method: "GET" | "POST" | "PATCH", body?: unknown, adminOnly = true): Promise<Response> {
  const current = await ctx(request, adminOnly); if ("response" in current) return current.response;
  try { return out(await fetch(`${BE}${path}`, { method, headers: { accept: "application/json", authorization: `Bearer ${current.token}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) })); }
  catch { return authError("Không kết nối được máy chủ nhân sự.", 503, "PEOPLE_UNAVAILABLE"); }
}
export async function accountList(request: NextRequest, query: URLSearchParams): Promise<Response> { return forward(request, `/api/v1/auth/accounts?${query}`, "GET"); }
export async function accountCreate(request: NextRequest): Promise<Response> {
  const guard = requireJsonPost(request); if (guard) return guard; const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response; const b = parsed.body;
  const username = typeof b.username === "string" ? b.username.trim() : ""; const password = typeof b.password === "string" ? b.password : ""; const email = typeof b.email === "string" ? b.email.trim() : ""; const role = typeof b.role === "string" ? b.role : "STAFF";
  if (username.length < 3 || username.length > 50) return authError("Tên đăng nhập phải từ 3 đến 50 ký tự.", 400, "INVALID_USERNAME");
  if (password.length < 6) return authError("Mật khẩu tối thiểu 6 ký tự.", 400, "INVALID_PASSWORD");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return authError("Email chưa đúng định dạng.", 400, "INVALID_EMAIL");
  if (!ROLES.has(role)) return authError("Chỉ được tạo tài khoản Quản lý hoặc Quản trị viên.", 400, "INVALID_ROLE");
  return forward(request, "/api/v1/auth/accounts", "POST", { username, password, email, role });
}
export async function accountUpdate(request: NextRequest, id: number): Promise<Response> {
  const guard = requireJsonPost(request); if (guard) return guard; const current = await ctx(request); if ("response" in current) return current.response; const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response; const b = parsed.body;
  const email = typeof b.email === "string" ? b.email.trim() : undefined; const status = typeof b.status === "string" ? b.status : undefined; const role = typeof b.role === "string" ? b.role : undefined; const newPassword = typeof b.newPassword === "string" ? b.newPassword : undefined;
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return authError("Email chưa đúng định dạng.", 400, "INVALID_EMAIL");
  if (status !== undefined && !STATUSES.has(status)) return authError("Trạng thái tài khoản chưa hỗ trợ.", 400, "INVALID_STATUS");
  if (role !== undefined && !ROLES.has(role)) return authError("Chỉ được gán vai trò Quản lý hoặc Quản trị viên.", 400, "INVALID_ROLE");
  if (newPassword !== undefined && newPassword.length < 6) return authError("Mật khẩu mới tối thiểu 6 ký tự.", 400, "INVALID_PASSWORD");
  if (id === current.id && (status !== undefined || role !== undefined || newPassword !== undefined)) return authError("Không thể đổi trạng thái, vai trò hoặc mật khẩu của chính tài khoản đang đăng nhập.", 403, "OWN_ACCOUNT_PROTECTED");
  const body: Record<string, unknown> = {}; if (email !== undefined) body.email = email; if (status !== undefined) body.status = status; if (role !== undefined) body.role = role; if (newPassword !== undefined) body.newPassword = newPassword;
  if (Object.keys(body).length === 0) return authError("Không có thay đổi hợp lệ.", 400, "EMPTY_UPDATE");
  return forward(request, `/api/v1/auth/accounts/${id}`, "PATCH", body);
}
function employeeFields(b: Record<string, unknown>, create: boolean): { ok: true; body: Record<string, unknown> } | { ok: false; response: Response } {
  const firstName = typeof b.firstName === "string" ? b.firstName.trim() : undefined; const lastName = typeof b.lastName === "string" ? b.lastName.trim() : undefined; const phoneNumber = typeof b.phoneNumber === "string" ? b.phoneNumber.trim() : undefined; const cccd = typeof b.cccd === "string" ? b.cccd.trim() : undefined; const gender = typeof b.gender === "string" ? b.gender : undefined; const dob = typeof b.dob === "string" ? b.dob.trim() : undefined; const address = typeof b.address === "string" ? b.address.trim() : undefined; const accountId = b.accountId;
  if (create && !lastName) return { ok: false, response: authError("Nhập tên trong hồ sơ nhân sự.", 400, "INVALID_LAST_NAME") };
  if (create && !phoneNumber) return { ok: false, response: authError("Nhập số điện thoại.", 400, "INVALID_PHONE") };
  if (create && !cccd) return { ok: false, response: authError("Nhập CCCD.", 400, "INVALID_CCCD") };
  if (firstName !== undefined && firstName.length > 50) return { ok: false, response: authError("Họ đệm tối đa 50 ký tự.", 400, "INVALID_FIRST_NAME") };
  if (lastName !== undefined && (!lastName || lastName.length > 50)) return { ok: false, response: authError("Tên phải từ 1 đến 50 ký tự.", 400, "INVALID_LAST_NAME") };
  if (phoneNumber !== undefined && !PHONE.test(phoneNumber)) return { ok: false, response: authError("Số điện thoại không đúng định dạng Việt Nam.", 400, "INVALID_PHONE") };
  if (cccd !== undefined && !CCCD.test(cccd)) return { ok: false, response: authError("CCCD phải đúng 12 chữ số.", 400, "INVALID_CCCD") };
  if (gender !== undefined && gender !== "" && !GENDERS.has(gender)) return { ok: false, response: authError("Giới tính chưa hợp lệ.", 400, "INVALID_GENDER") };
  if (dob !== undefined && dob !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { ok: false, response: authError("Ngày sinh phải có dạng YYYY-MM-DD.", 400, "INVALID_DOB") };
  if (address !== undefined && address.length > 255) return { ok: false, response: authError("Địa chỉ tối đa 255 ký tự.", 400, "INVALID_ADDRESS") };
  if (accountId !== undefined && accountId !== null && (typeof accountId !== "number" || !Number.isSafeInteger(accountId) || accountId < 1)) return { ok: false, response: authError("Tài khoản liên kết chưa hợp lệ.", 400, "INVALID_ACCOUNT") };
  if (accountId === null) return { ok: false, response: authError("Chưa hỗ trợ gỡ liên kết tài khoản.", 400, "UNLINK_UNSUPPORTED") };
  const body: Record<string, unknown> = {}; if (firstName !== undefined) body.firstName = firstName; if (lastName !== undefined) body.lastName = lastName; if (phoneNumber !== undefined) body.phoneNumber = phoneNumber; if (cccd !== undefined) body.cccd = cccd; if (gender !== undefined && gender !== "") body.gender = gender; if (dob !== undefined && dob !== "") body.dob = dob; if (address !== undefined) body.address = address; if (accountId !== undefined) body.accountId = accountId;
  return { ok: true, body };
}
async function eligibleInternalAccount(token: string, id: number, signal: AbortSignal): Promise<boolean> {
  for (const role of ["STAFF", "ADMIN"]) {
    for (let page = 0; page < 20; page++) {
      try {
        const response = await fetch(`${BE}/api/v1/auth/accounts?page=${page}&size=50&role=${role}&sort=id,desc`, { headers: { accept: "application/json", authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
        if (!response.ok) return false;
        const payload = await response.json() as { result?: { content?: Array<{ id?: number }>; last?: boolean } };
        const result = payload.result;
        if (!result || !Array.isArray(result.content)) return false;
        if (result.content.some((account) => account.id === id)) return true;
        if (result.last) break;
      } catch { return false; }
    }
  }
  return false;
}
export async function employeeList(request: NextRequest, query: URLSearchParams): Promise<Response> { return forward(request, `/api/v1/users/employees?${query}`, "GET", undefined, false); }
export async function employeeGet(request: NextRequest, id: number): Promise<Response> { return forward(request, `/api/v1/users/employees/${id}`, "GET", undefined, false); }
export async function employeeCreate(request: NextRequest): Promise<Response> { const guard = requireJsonPost(request); if (guard) return guard; const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response; const checked = employeeFields(parsed.body, true); if (!checked.ok) return checked.response; const current = await ctx(request, false); if ("response" in current) return current.response; if (current.role !== "ADMIN" && checked.body.accountId !== undefined) return authError("Chỉ Quản trị viên hệ thống được liên kết tài khoản nội bộ.", 403, "ADMIN_REQUIRED"); if (checked.body.accountId !== undefined && !(await eligibleInternalAccount(current.token, checked.body.accountId as number, request.signal))) return authError("Chỉ được liên kết tài khoản Quản lý/Quản trị viên đang tồn tại.", 400, "INVALID_ACCOUNT"); return forward(request, "/api/v1/users/employees", "POST", checked.body, false); }
export async function employeeUpdate(request: NextRequest, id: number): Promise<Response> { const guard = requireJsonPost(request); if (guard) return guard; const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response; const checked = employeeFields(parsed.body, false); if (!checked.ok) return checked.response; const current = await ctx(request, false); if ("response" in current) return current.response; if (current.role !== "ADMIN" && checked.body.accountId !== undefined) return authError("Chỉ Quản trị viên hệ thống được liên kết tài khoản nội bộ.", 403, "ADMIN_REQUIRED"); if (checked.body.accountId !== undefined && !(await eligibleInternalAccount(current.token, checked.body.accountId as number, request.signal))) return authError("Chỉ được liên kết tài khoản Quản lý/Quản trị viên đang tồn tại.", 400, "INVALID_ACCOUNT"); return forward(request, `/api/v1/users/employees/${id}`, "PATCH", checked.body, false); }
export function idOf(raw: string): number | null { if (!/^[1-9]\d*$/.test(raw)) return null; const n = Number(raw); return Number.isSafeInteger(n) ? n : null; }
