import type { NextRequest } from "next/server";
import { authCookie, authError, readJsonObject, requireJsonPost } from "@/lib/server/customer-auth";
import { adminIdentity, BE } from "@/lib/server/admin-bff";

const TARGETS = new Set(["CONFIRMED", "PACKING", "SHIPPING", "COMPLETED"]);
const MAX_NOTE = 1000;
function out(upstream: Response): Response {
  const h = new Headers({ "cache-control": "no-store" });
  const type = upstream.headers.get("content-type"); if (type) h.set("content-type", type);
  return new Response(upstream.body, { status: upstream.status, headers: h });
}
export async function patchOrderStatus(request: NextRequest, id: number): Promise<Response> {
  const guard = requireJsonPost(request); if (guard) return guard;
  const who = await adminIdentity(request); if ("response" in who) return who.response;
  const token = authCookie(request); if (!token) return authError("Thiếu phiên quản trị.", 401, "AUTH_REQUIRED");
  const parsed = await readJsonObject(request); if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const status = typeof body.status === "string" ? body.status : "";
  if (!TARGETS.has(status)) return authError("Chỉ được chọn bước kế tiếp hợp lệ của đơn.", 400, "INVALID_TARGET");
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > MAX_NOTE) return authError("Ghi chú tối đa 1000 ký tự.", 400, "INVALID_NOTE");
  try {
    return out(await fetch(`${BE}/api/v1/orders/${id}/status`, {
      method: "PATCH",
      headers: { accept: "application/json", authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ status, ...(note ? { note } : {}) }),
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]),
    }));
  } catch {
    return Response.json({ success: false, code: 503, message: "Không kết nối được máy chủ đơn hàng.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
