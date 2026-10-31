import type { NextRequest } from "next/server";
import { adminIdentity, BE } from "@/lib/server/admin-bff";
import { authCookie } from "@/lib/server/customer-auth";

const ACTIVE = ["PENDING", "CONFIRMED", "PACKING"] as const;
type Envelope<T> = { success?: boolean; code?: number; message?: string; result?: T };
type Order = { orderId: number; orderCode: string; status: string; customerName?: string | null; totalAmount: number; createdAt: string };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const who = await adminIdentity(request);
  if ("response" in who) return who.response;
  const token = authCookie(request);
  if (!token) return Response.json({ success: false, code: 401, message: "Thiếu phiên quản trị.", result: null }, { status: 401 });
  try {
    const results = await Promise.all(ACTIVE.map(async (status) => {
      const q = new URLSearchParams({ status, page: "0", size: "3", sort: "orderDate,asc" });
      const r = await fetch(`${BE}/api/v1/orders?${q}`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" }, cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
      const payload = (await r.json()) as Envelope<{ content?: Order[]; totalElements?: number }>;
      if (!r.ok || !payload.success || !payload.result) throw new Error("upstream");
      return { status, total: Number(payload.result.totalElements ?? 0), rows: Array.isArray(payload.result.content) ? payload.result.content : [] };
    }));
    const groups = Object.fromEntries(results.map((r) => [r.status, {
      total: r.total,
      rows: r.rows.sort((a, b) => (Date.parse(a.createdAt) - Date.parse(b.createdAt)) || a.orderId - b.orderId).slice(0, 3),
    }]));
    const counts = Object.fromEntries(results.map((r) => [r.status, r.total]));
    return Response.json({ success: true, code: 200, result: { role: who.identity.role, counts, queueTotal: results.reduce((n, r) => n + r.total, 0), groups, fetchedAt: new Date().toISOString() } }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ success: false, code: 503, message: "Không tải được hàng đợi đơn.", result: null }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
