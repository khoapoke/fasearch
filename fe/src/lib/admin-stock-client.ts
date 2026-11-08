export type Stock = { skuId: number; productId: number; productName: string; color: string | null; size: string | null; barcode: string | null; physicalStock: number | null; reservedStock: number | null; availableStock: number | null; minThreshold: number | null; productStatus?: string | null };
export type Page<T> = { content: T[]; pageNumber: number; pageSize: number; totalElements: number; totalPages: number; last: boolean };
export type ImportItem = { id: number; skuId: number; productName: string; color: string | null; size: string | null; barcode: string | null; quantity: number; importPrice: number; subTotal: number };
export type ImportSummary = { receiptId: number; receiptCode: string; supplierName: string; totalItems: number; totalQuantity: number; totalAmount: number; status: string; createdAt: string };
export type ImportDetail = ImportSummary & { note: string | null; items: ImportItem[] };
export class StockError extends Error { status: number; code: string; constructor(message: string, status: number, code = "STOCK_ERROR") { super(message); this.name = "StockError"; this.status = status; this.code = code; } }
type Envelope<T> = { success?: boolean; message?: string; code?: string; result?: T };
async function parse<T>(r: Response): Promise<T> { let j: Envelope<T> | null = null; try { j = await r.json(); } catch {} if (!r.ok || j?.success !== true || j.result === undefined) throw new StockError(j?.message || "Không tải được dữ liệu tồn kho.", r.status || 502, j?.code); return j.result; }
export const getStockPage = async (q: string, signal?: AbortSignal) => parse<Page<Stock>>(await fetch(`/api/admin/stock?${q}`, { cache: "no-store", signal }));
export const getStock = async (id: string, signal?: AbortSignal) => parse<Stock>(await fetch(`/api/admin/stock/${id}`, { cache: "no-store", signal }));
export const getImportPage = async (q: string, signal?: AbortSignal) => parse<Page<ImportSummary>>(await fetch(`/api/admin/imports?${q}`, { cache: "no-store", signal }));
export const getImport = async (id: string, signal?: AbortSignal) => parse<ImportDetail>(await fetch(`/api/admin/imports/${id}`, { cache: "no-store", signal }));
export const createImport = async (body: { supplierName: string; note: string; items: Array<{ skuId: number; quantity: number; importPrice: number }> }) => parse<ImportDetail>(await fetch("/api/admin/imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
export const money = (v: number) => v.toLocaleString("vi-VN") + " VND";
export const stockValue = (v: number | null) => v === null || v === undefined ? "Không có dữ liệu" : String(v);
