export type StocktakeSummary = { stocktakeId: number; stocktakeCode: string; note: string | null; totalItems: number; totalDiscrepancy: number; status: string; createdAt: string };
export type StocktakeRow = { id: number; skuId: number; productName: string; color: string | null; size: string | null; barcode: string | null; systemCount: number; actualCount: number; difference: number };
export type StocktakeDetail = Omit<StocktakeSummary, "totalItems"> & { discrepancies: StocktakeRow[] };
export type Page<T> = { content: T[]; pageNumber: number; pageSize: number; totalElements: number; totalPages: number; last: boolean };
export class StocktakeError extends Error { status: number; code: string; constructor(message: string, status: number, code = "STOCKTAKE_ERROR") { super(message); this.name = "StocktakeError"; this.status = status; this.code = code; } }
type Envelope<T> = { success?: boolean; message?: string; code?: string; result?: T };
async function parse<T>(r: Response): Promise<T> { let j: Envelope<T> | null = null; try { j = await r.json(); } catch {} if (!r.ok || j?.success !== true || j.result === undefined) throw new StocktakeError(j?.message || "Yêu cầu kiểm kê thất bại.", r.status || 502, j?.code); return j.result; }
export const getStocktakePage = async (q: string, signal?: AbortSignal) => parse<Page<StocktakeSummary>>(await fetch(`/api/admin/stocktakes?${q}`, { cache: "no-store", signal }));
export const getStocktake = async (id: string, signal?: AbortSignal) => parse<StocktakeDetail>(await fetch(`/api/admin/stocktakes/${id}`, { cache: "no-store", signal }));
export const createStocktake = async (body: { note: string; records: Array<{ skuId: number; actualCount: number }> }) => parse<StocktakeDetail>(await fetch("/api/admin/stocktakes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
export const signed = (v: number) => v > 0 ? `+${v}` : String(v);
export const statusLabel = (v: string) => v === "PENDING_APPROVAL" ? "Chờ duyệt" : v === "RECONCILED" ? "Đã đối soát" : v === "CANCELLED" ? "Đã hủy" : v;
