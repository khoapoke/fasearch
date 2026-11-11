export type ExportSummary = { receiptId: number; receiptCode: string; exportType: string; totalItems: number; totalQuantity: number; status: string; note: string | null; createdAt: string };
export type ExportItem = { id: number; skuId: number; productName: string; color: string | null; size: string | null; barcode: string | null; quantity: number; reason: string | null };
export type ExportDetail = ExportSummary & { items: ExportItem[] };
export type Page<T> = { content: T[]; pageNumber: number; pageSize: number; totalElements: number; totalPages: number; last: boolean };
export class ExportError extends Error { status: number; code: string; constructor(message: string, status: number, code = "EXPORT_ERROR") { super(message); this.name = "ExportError"; this.status = status; this.code = code; } }
async function parse<T>(r: Response): Promise<T> { let j: { success?: boolean; message?: string; code?: string; result?: T } | null = null; try { j = await r.json(); } catch {} if (!r.ok || j?.success !== true || j.result === undefined) throw new ExportError(j?.message || "Yêu cầu phiếu xuất thất bại.", r.status || 502, j?.code); return j.result; }
export const getExportPage = async (q: string, signal?: AbortSignal) => parse<Page<ExportSummary>>(await fetch(`/api/admin/exports?${q}`, { cache: "no-store", signal }));
export const getExport = async (id: string, signal?: AbortSignal) => parse<ExportDetail>(await fetch(`/api/admin/exports/${id}`, { cache: "no-store", signal }));
export const createExport = async (body: { exportType: string; note: string; items: Array<{ skuId: number; quantity: number; reason?: string }> }) => parse<ExportDetail>(await fetch("/api/admin/exports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
export const exportMoney = (v: number) => v.toLocaleString("vi-VN");
