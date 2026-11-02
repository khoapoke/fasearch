export type Category = { id: number; categoryName: string };
export type Variant = { skuId: number; productId: number; color: string | null; size: string | null; barcode: string | null; additionalPrice: number };
export type Product = { id: number; productName: string; categoryId: number | null; categoryName: string | null; material: string | null; style: string | null; description?: string | null; price: number; imageUrl: string | null; status: string; variants?: Variant[] };
export type ProductPage = { content: Product[]; pageNumber: number; pageSize: number; totalElements: number; totalPages: number; last: boolean };
export class CatalogAdminError extends Error { status: number; code: string; errors?: Array<{ field?: string; reason?: string }>; constructor(message: string, status: number, code = "CATALOG_ERROR", errors?: Array<{ field?: string; reason?: string }>) { super(message); this.name = "CatalogAdminError"; this.status = status; this.code = code; this.errors = errors; } }
type Envelope<T> = { success?: boolean; message?: string; code?: string; result?: T; errors?: Array<{ field?: string; reason?: string }> };
async function parse<T>(r: Response): Promise<T> { let j: Envelope<T> | null = null; try { j = await r.json(); } catch {} if (!r.ok || j?.success !== true || j.result === undefined) throw new CatalogAdminError(j?.message || "Yêu cầu catalog thất bại.", r.status || 502, j?.code, j?.errors); return j.result; }
export async function getCategories(signal?: AbortSignal): Promise<Category[]> { return parse<Category[]>(await fetch("/api/admin/catalog/categories", { cache: "no-store", signal })); }
export async function getProductPage(q: string, signal?: AbortSignal): Promise<ProductPage> { return parse<ProductPage>(await fetch(`/api/admin/catalog/products?${q}`, { cache: "no-store", signal })); }
export async function getProduct(id: string, signal?: AbortSignal): Promise<Product> { return parse<Product>(await fetch(`/api/admin/catalog/products/${id}`, { cache: "no-store", signal })); }
export async function createProduct(body: Record<string, unknown>): Promise<Product> { return parse<Product>(await fetch("/api/admin/catalog/products", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })); }
export async function updateProduct(id: string, body: Record<string, unknown>): Promise<Product> { return parse<Product>(await fetch(`/api/admin/catalog/products/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })); }
export async function deleteProduct(id: string): Promise<boolean> { return parse<boolean>(await fetch(`/api/admin/catalog/products/${id}`, { method: "DELETE" })); }
export async function createVariant(productId: string, body: Record<string, unknown>): Promise<Variant> { return parse<Variant>(await fetch(`/api/admin/catalog/products/${productId}/variants`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })); }
export async function updateVariant(skuId: number, body: Record<string, unknown>): Promise<Variant> { return parse<Variant>(await fetch(`/api/admin/catalog/variants/${skuId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })); }
export async function getBarcode(skuId: number): Promise<{ skuId: number; barcode: string | null; barcodeBase64: string | null; productName: string }> { return parse(await fetch(`/api/admin/catalog/variants/${skuId}/barcode`, { cache: "no-store" })); }
export async function createCategory(name: string): Promise<Category> { return parse<Category>(await fetch("/api/admin/catalog/categories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryName: name }) })); }
export async function updateCategory(id: number, name: string): Promise<Category> { return parse<Category>(await fetch(`/api/admin/catalog/categories/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryName: name }) })); }
export async function deleteCategory(id: number): Promise<boolean> { return parse<boolean>(await fetch(`/api/admin/catalog/categories/${id}`, { method: "DELETE" })); }
export async function uploadProductImage(id: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(`/api/admin/catalog/products/${id}/image`, { method: "POST", body: form });
  return parse<string>(r);
}

/** Map a BE-relative image URL (/api/v1/products/images/...) to the same-origin BFF path. */
export function toCatalogImageUrl(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/^\/api\/v1\/products\/images\/(.+)$/);
  if (m) return `/api/catalog/product-images/${m[1]}`;
  return raw;
}

export { CatalogAdminError as CatalogError };

/** ---- Publication draft + AI sync (BE contract v1) ---- */

export type AdminDraft = {
  draftId: number;
  productId: number | null;
  version: number;
  status: string;
  updatedAt?: string | null;
  [k: string]: unknown;
};

export type AiSyncState = {
  productId: number;
  version: number;
  status: string;
  attempts: number;
  updatedAt: string | null;
  lastError?: string | null;
};

export async function listDrafts(query = "page=0&size=20", signal?: AbortSignal): Promise<AdminDraft[]> {
  // BE trả PageResponse {content:[...]}; một số bản cũ trả mảng trần — chấp nhận cả hai.
  const result = await parse<unknown>(await fetch(`/api/admin/catalog/drafts?${query}`, { cache: "no-store", signal }));
  if (Array.isArray(result)) return result as AdminDraft[];
  const page = result as { content?: unknown } | null;
  return Array.isArray(page?.content) ? (page?.content as AdminDraft[]) : [];
}

export async function getDraft(draftId: number | string, signal?: AbortSignal): Promise<AdminDraft> {
  return parse<AdminDraft>(await fetch(`/api/admin/catalog/drafts/${draftId}`, { cache: "no-store", signal }));
}

export async function createDraft(body: Record<string, unknown>, signal?: AbortSignal): Promise<AdminDraft> {
  return parse<AdminDraft>(await fetch("/api/admin/catalog/drafts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal }));
}

export async function updateDraft(draftId: number | string, body: Record<string, unknown>, signal?: AbortSignal): Promise<AdminDraft> {
  return parse<AdminDraft>(await fetch(`/api/admin/catalog/drafts/${draftId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal }));
}

export async function deleteDraft(draftId: number | string, signal?: AbortSignal): Promise<unknown> {
  return parse<unknown>(await fetch(`/api/admin/catalog/drafts/${draftId}`, { method: "DELETE", signal }));
}

/** BE trả `result` là chuỗi URL ảnh nháp (ADMIN-only), không phải object. */
export function resolveDraftImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/^\/api\/v1\/admin\/products\/drafts\/(\d+)\/images\/(.+)$/);
  return m ? `/api/admin/catalog/drafts/${m[1]}/images/${m[2]}` : raw;
}

export async function uploadDraftImage(draftId: number | string, file: File, signal?: AbortSignal): Promise<{ imageUrl: string | null }> {
  const form = new FormData();
  form.append("file", file);
  const result = await parse<unknown>(await fetch(`/api/admin/catalog/drafts/${draftId}/images`, { method: "POST", body: form, signal }));
  const raw = typeof result === "string" ? result : (result as { imageUrl?: unknown } | null)?.imageUrl;
  return { imageUrl: resolveDraftImageUrl(typeof raw === "string" ? raw : null) };
}

export async function publishDraft(draftId: number | string, expectedVersion: number, signal?: AbortSignal): Promise<{ productId: number; version: number; status: string }> {
  return parse(await fetch(`/api/admin/catalog/drafts/${draftId}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion }), signal }));
}

export async function unpublishProduct(productId: number | string, reason?: string, signal?: AbortSignal): Promise<unknown> {
  return parse<unknown>(await fetch(`/api/admin/catalog/products/${productId}/unpublish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(reason ? { reason } : {}), signal }));
}

export async function getAiSync(productId: number | string, signal?: AbortSignal): Promise<AiSyncState> {
  return parse<AiSyncState>(await fetch(`/api/admin/catalog/products/${productId}/ai-sync`, { cache: "no-store", signal }));
}

export async function retryAiSync(productId: number | string, signal?: AbortSignal): Promise<unknown> {
  return parse<unknown>(await fetch(`/api/admin/catalog/products/${productId}/ai-sync/retry`, { method: "POST", signal }));
}

export async function importUrl(url: string, signal?: AbortSignal): Promise<{ draftId: number }> {
  return parse<{ draftId: number }>(await fetch("/api/admin/catalog/import-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }), signal }));
}
