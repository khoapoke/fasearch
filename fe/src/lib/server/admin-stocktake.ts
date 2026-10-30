import type { NextRequest } from "next/server";
import { authError, authCookie, readJsonObject, requireJsonPost } from "@/lib/server/customer-auth";
import { adminIdentity } from "@/lib/server/admin-bff";

const BE = "http://127.0.0.1:18118";
const MAX_LINES = 50;
const MAX_COUNT = 1_000_000;

function headers(token: string): Record<string, string> {
  return { accept: "application/json", authorization: `Bearer ${token}` };
}

function out(upstream: Response): Response {
  const h = new Headers({ "cache-control": "no-store" });
  const type = upstream.headers.get("content-type");
  if (type) h.set("content-type", type);
  return new Response(upstream.body, { status: upstream.status, headers: h });
}

async function tokenFor(request: NextRequest): Promise<{ token: string } | { response: Response }> {
  const who = await adminIdentity(request);
  if ("response" in who) return { response: who.response };
  // BE grants this route to both ADMIN and STAFF; unlike import/export writes,
  // do not narrow it to ADMIN here.
  const token = authCookie(request);
  if (!token) return { response: authError("Thiếu phiên kiểm kê.", 401, "AUTH_REQUIRED") };
  return { token };
}

export async function stocktakeRead(request: NextRequest, path: string): Promise<Response> {
  const current = await tokenFor(request);
  if ("response" in current) return current.response;
  try {
    return out(await fetch(`${BE}${path}`, {
      method: "GET",
      headers: headers(current.token),
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]),
    }));
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ kiểm kê.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

export async function stocktakeCreate(request: NextRequest): Promise<Response> {
  const guard = requireJsonPost(request); if (guard) return guard;
  const current = await tokenFor(request);
  if ("response" in current) return current.response;
  const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 1000) return authError("Ghi chú kiểm kê tối đa 1000 ký tự.", 400, "INVALID_NOTE");
  if (!Array.isArray(body.records) || body.records.length < 1 || body.records.length > MAX_LINES) return authError(`Phiếu kiểm kê phải có từ 1 đến ${MAX_LINES} dòng.`, 400, "INVALID_RECORDS");
  const seen = new Set<number>();
  const records: Array<{ skuId: number; actualCount: number }> = [];
  for (const raw of body.records) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return authError("Dòng kiểm kê chưa hợp lệ.", 400, "INVALID_RECORD");
    const row = raw as Record<string, unknown>;
    if (typeof row.skuId !== "number" || !Number.isSafeInteger(row.skuId) || row.skuId < 1) return authError("SKU chưa hợp lệ.", 400, "INVALID_SKU");
    if (seen.has(row.skuId)) return authError("Mỗi SKU chỉ được xuất hiện một lần trong phiếu.", 400, "DUPLICATE_SKU");
    seen.add(row.skuId);
    if (typeof row.actualCount !== "number" || !Number.isSafeInteger(row.actualCount) || row.actualCount < 0 || row.actualCount > MAX_COUNT) return authError("Số đếm phải là số nguyên từ 0 đến 1.000.000.", 400, "INVALID_ACTUAL_COUNT");
    records.push({ skuId: row.skuId, actualCount: row.actualCount });
  }
  try {
    return out(await fetch(`${BE}/api/v1/inventory/stocktakes`, {
      method: "POST",
      headers: { ...headers(current.token), "content-type": "application/json" },
      body: JSON.stringify({ ...(note ? { note } : {}), records }),
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]),
    }));
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ kiểm kê.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
