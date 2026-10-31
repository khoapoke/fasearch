import type { NextRequest } from "next/server";
import { authCookie, authError, fetchMyInfo, readJsonObject, requireJsonPost } from "@/lib/server/customer-auth";
const BE = "http://127.0.0.1:18122";
const GENDERS = new Set(["MALE", "FEMALE", "OTHER"]);
const PHONE = /^(0|\+84)[0-9]{9}$/;
function out(up: Response): Response { const h = new Headers({ "cache-control": "no-store" }); const t = up.headers.get("content-type"); if (t) h.set("content-type", t); return new Response(up.body, { status: up.status, headers: h }); }
async function own(request: NextRequest): Promise<{ token: string; customerId: number } | { response: Response }> {
  const token = authCookie(request); if (!token) return { response: authError("Cần đăng nhập khách hàng.", 401, "AUTH_REQUIRED") };
  try {
    const { response, payload } = await fetchMyInfo(token, request.signal);
    if (!response.ok || payload?.success !== true) return { response: authError("Không xác minh được hồ sơ.", response.status || 502, "IDENTITY_UNAVAILABLE") };
    const role = payload.result?.role; const customerId = payload.result?.customerId;
    if (role !== "CUSTOMER") return { response: authError("Tài khoản không có hồ sơ khách hàng.", 403, "CUSTOMER_PROFILE_REQUIRED") };
    if (typeof customerId !== "number" || !Number.isSafeInteger(customerId) || customerId < 1) return { response: authError("Tài khoản chưa có hồ sơ khách hàng.", 404, "CUSTOMER_PROFILE_NOT_FOUND") };
    return { token, customerId };
  } catch { return { response: authError("Không xác minh được hồ sơ khách hàng.", 503, "AUTH_UNAVAILABLE") }; }
}
export async function getSelfProfile(request: NextRequest): Promise<Response> {
  const who = await own(request); if ("response" in who) return who.response;
  try { return out(await fetch(`${BE}/api/v1/users/customers/${who.customerId}`, { method: "GET", headers: { accept: "application/json", authorization: `Bearer ${who.token}` }, cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) })); }
  catch { return authError("Không kết nối được máy chủ hồ sơ.", 503, "PROFILE_UNAVAILABLE"); }
}
export async function updateSelfProfile(request: NextRequest): Promise<Response> {
  const guard = requireJsonPost(request); if (guard) return guard;
  const who = await own(request); if ("response" in who) return who.response;
  const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response;
  const b = parsed.body; const firstName = typeof b.firstName === "string" ? b.firstName.trim() : undefined; const lastName = typeof b.lastName === "string" ? b.lastName.trim() : undefined; const phoneNumber = typeof b.phoneNumber === "string" ? b.phoneNumber.trim() : undefined; const gender = typeof b.gender === "string" ? b.gender : undefined; const dob = typeof b.dob === "string" ? b.dob.trim() : undefined; const address = typeof b.address === "string" ? b.address.trim() : undefined;
  if (firstName !== undefined && firstName.length > 50) return authError("Họ đệm tối đa 50 ký tự.", 400, "INVALID_FIRST_NAME");
  if (lastName !== undefined && (!lastName || lastName.length > 50)) return authError("Tên phải từ 1 đến 50 ký tự.", 400, "INVALID_LAST_NAME");
  if (phoneNumber !== undefined && !PHONE.test(phoneNumber)) return authError("Số điện thoại không đúng định dạng Việt Nam.", 400, "INVALID_PHONE");
  if (gender !== undefined && gender !== "" && !GENDERS.has(gender)) return authError("Giới tính chưa hợp lệ.", 400, "INVALID_GENDER");
  if (dob !== undefined && dob !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return authError("Ngày sinh phải có dạng YYYY-MM-DD.", 400, "INVALID_DOB");
  if (address !== undefined && address.length > 255) return authError("Địa chỉ tối đa 255 ký tự.", 400, "INVALID_ADDRESS");
  const body: Record<string, unknown> = {};
  if (firstName !== undefined) body.firstName = firstName; if (lastName !== undefined) body.lastName = lastName; if (phoneNumber !== undefined) body.phoneNumber = phoneNumber; if (gender !== undefined && gender !== "") body.gender = gender; if (dob !== undefined && dob !== "") body.dob = dob; if (address !== undefined) body.address = address;
  try { return out(await fetch(`${BE}/api/v1/users/customers/${who.customerId}`, { method: "PATCH", headers: { accept: "application/json", authorization: `Bearer ${who.token}`, "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) })); }
  catch { return authError("Không kết nối được máy chủ hồ sơ.", 503, "PROFILE_UNAVAILABLE"); }
}
