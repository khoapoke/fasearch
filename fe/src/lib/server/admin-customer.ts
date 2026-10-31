import type { NextRequest } from "next/server";
import { authCookie, authError, readJsonObject, requireJsonPost } from "@/lib/server/customer-auth";
import { adminIdentity, BE } from "@/lib/server/admin-bff";

const GENDERS = new Set(["MALE", "FEMALE", "OTHER"]);
const PHONE = /^(0|\+84)[0-9]{9}$/;
const MAX_NAME = 50;
const MAX_ADDRESS = 255;

function out(upstream: Response): Response {
  const h = new Headers({ "cache-control": "no-store" });
  const type = upstream.headers.get("content-type"); if (type) h.set("content-type", type);
  return new Response(upstream.body, { status: upstream.status, headers: h });
}
async function context(request: NextRequest): Promise<{ token: string } | { response: Response }> {
  const who = await adminIdentity(request); if ("response" in who) return { response: who.response };
  const token = authCookie(request); if (!token) return { response: authError("Thiếu phiên quản trị.", 401, "AUTH_REQUIRED") };
  return { token };
}
export async function customerRead(request: NextRequest, path: string): Promise<Response> {
  const ctx = await context(request); if ("response" in ctx) return ctx.response;
  try {
    return out(await fetch(`${BE}${path}`, { method: "GET", headers: { accept: "application/json", authorization: `Bearer ${ctx.token}` }, cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) }));
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ khách hàng.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
function fields(body: Record<string, unknown>, create: boolean): { ok: true; body: Record<string, unknown> } | { ok: false; response: Response } {
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : undefined;
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : undefined;
  const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : undefined;
  const gender = typeof body.gender === "string" ? body.gender : undefined;
  const dob = typeof body.dob === "string" ? body.dob.trim() : undefined;
  const address = typeof body.address === "string" ? body.address.trim() : undefined;
  if (create && !lastName) return { ok: false, response: authError("Nhập tên khách hàng.", 400, "INVALID_LAST_NAME") };
  if (create && !phoneNumber) return { ok: false, response: authError("Nhập số điện thoại.", 400, "INVALID_PHONE") };
  if (firstName !== undefined && firstName.length > MAX_NAME) return { ok: false, response: authError("Họ đệm tối đa 50 ký tự.", 400, "INVALID_FIRST_NAME") };
  if (lastName !== undefined && lastName.length > MAX_NAME) return { ok: false, response: authError("Tên tối đa 50 ký tự.", 400, "INVALID_LAST_NAME") };
  if (phoneNumber !== undefined && !PHONE.test(phoneNumber)) return { ok: false, response: authError("Số điện thoại không đúng định dạng Việt Nam.", 400, "INVALID_PHONE") };
  if (gender !== undefined && gender !== "" && !GENDERS.has(gender)) return { ok: false, response: authError("Giới tính chưa hợp lệ.", 400, "INVALID_GENDER") };
  if (dob !== undefined && dob !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { ok: false, response: authError("Ngày sinh phải có dạng YYYY-MM-DD.", 400, "INVALID_DOB") };
  if (address !== undefined && address.length > MAX_ADDRESS) return { ok: false, response: authError("Địa chỉ tối đa 255 ký tự.", 400, "INVALID_ADDRESS") };
  const payload: Record<string, unknown> = {};
  if (firstName !== undefined) payload.firstName = firstName;
  if (lastName !== undefined) payload.lastName = lastName;
  if (phoneNumber !== undefined) payload.phoneNumber = phoneNumber;
  if (gender !== undefined && gender !== "") payload.gender = gender;
  if (dob !== undefined && dob !== "") payload.dob = dob;
  if (address !== undefined) payload.address = address;
  return { ok: true, body: payload };
}
export async function customerWrite(request: NextRequest, path: string, method: "POST" | "PATCH", create: boolean): Promise<Response> {
  const guard = requireJsonPost(request); if (guard) return guard;
  const ctx = await context(request); if ("response" in ctx) return ctx.response;
  const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response;
  const checked = fields(parsed.body, create); if (!checked.ok) return checked.response;
  try {
    return out(await fetch(`${BE}${path}`, { method, headers: { accept: "application/json", authorization: `Bearer ${ctx.token}`, "content-type": "application/json" }, body: JSON.stringify(checked.body), cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) }));
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ khách hàng.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
export function idOf(raw: string): number | null { if (!/^[1-9]\d*$/.test(raw)) return null; const n = Number(raw); return Number.isSafeInteger(n) ? n : null; }
