import { normalizeOrderDetail, type CustomerOrderDetail } from "@/lib/customer-commerce";
export type OrderDetail = CustomerOrderDetail;
export class OrderError extends Error { status: number; code: string; constructor(message: string, status: number, code = "ORDER_ERROR") { super(message); this.name = "OrderError"; this.status = status; this.code = code; } }
type Envelope<T> = { success?: boolean; message?: string; code?: number | string; result?: T };
async function parse<T>(r: Response): Promise<T> { let j: Envelope<T> | null = null; try { j = await r.json(); } catch {} if (!r.ok || j?.success !== true || j.result === undefined) throw new OrderError(j?.message || "Không cập nhật được đơn.", r.status || 502, j?.code === undefined ? "ORDER_ERROR" : String(j.code)); return j.result; }
export const getOrder = async (id: string, signal?: AbortSignal) => normalizeOrderDetail(await parse<unknown>(await fetch(`/api/admin/orders/${id}`, { cache: "no-store", signal })));
export const updateOrderStatus = async (id: string, status: string, note: string, signal?: AbortSignal) => normalizeOrderDetail(await parse<unknown>(await fetch(`/api/admin/orders/${id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, ...(note.trim() ? { note: note.trim() } : {}) }), signal })));
export const cancelAdminOrder = async (id: string, reason: string, signal?: AbortSignal) => normalizeOrderDetail(await parse<unknown>(await fetch(`/api/admin/orders/${id}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }), signal })));
export async function recordCashCollection(id: string, amountPaid: number, note: string | null, signal?: AbortSignal): Promise<void> {
  await parse<unknown>(await fetch(`/api/admin/orders/${id}/cash-collection`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amountPaid, note }), signal }));
}
