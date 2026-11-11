// Data for barcode labels: one call per SKU for barcode + base price, one per product for the variant surcharge.
export type LabelItem = { skuId: number; productId: number; productName: string; color: string | null; size: string | null; price: number; barcode: string };
type Envelope<T> = { success?: boolean; message?: string; result?: T };
type BarcodeInfo = { skuId: number; productId: number; productName: string; color: string | null; size: string | null; price: number | null; barcode: string | null };
type ProductInfo = { price: number; variants?: Array<{ skuId: number; additionalPrice: number | null }> };

async function read<T>(r: Response, fallback: string): Promise<T> {
  let j: Envelope<T> | null = null;
  try { j = await r.json(); } catch {}
  if (!r.ok || j?.success !== true || j.result === undefined || j.result === null) throw new Error(j?.message || fallback);
  return j.result;
}

const products = new Map<number, Promise<ProductInfo>>();

export async function loadLabelItem(skuId: number, signal?: AbortSignal): Promise<LabelItem> {
  const info = await read<BarcodeInfo>(await fetch(`/api/admin/catalog/variants/${skuId}/barcode`, { cache: "no-store", signal }), "Không đọc được SKU.");
  if (!info.barcode) throw new Error("SKU chưa có Barcode.");
  let p = products.get(info.productId);
  if (!p) {
    p = fetch(`/api/admin/catalog/products/${info.productId}`, { cache: "no-store", signal }).then((r) => read<ProductInfo>(r, "Không đọc được giá sản phẩm."));
    products.set(info.productId, p);
    p.catch(() => products.delete(info.productId));
  }
  const prod = await p;
  const extra = prod.variants?.find((v) => v.skuId === skuId)?.additionalPrice ?? 0;
  return { skuId: info.skuId, productId: info.productId, productName: info.productName, color: info.color, size: info.size, price: (prod.price ?? info.price ?? 0) + (extra ?? 0), barcode: info.barcode };
}

/** "12:3,15,20:1" -> [{skuId:12, qty:3}, ...]; ignores junk, merges duplicates, caps the list. */
export function parseItemsParam(raw: string | null | undefined, maxSkus = 300): Array<{ skuId: number; qty: number }> {
  const out = new Map<number, number>();
  for (const part of (raw ?? "").split(",")) {
    const m = /^\s*(\d{1,12})(?::(\d{1,4}))?\s*$/.exec(part);
    if (!m) continue;
    const id = Number(m[1]); const qty = m[2] ? Number(m[2]) : 1;
    if (!Number.isSafeInteger(id) || id < 1) continue;
    out.set(id, (out.get(id) ?? 0) + Math.max(1, qty));
    if (out.size >= maxSkus) break;
  }
  return [...out].map(([skuId, qty]) => ({ skuId, qty: Math.min(qty, 999) }));
}
