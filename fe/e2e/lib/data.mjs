// Runtime data discovery so the suite does not depend on fixed product / SKU ids.
import { cfg } from "./config.mjs";
import { res } from "./http.mjs";

export async function discoverProduct(client) {
  if (cfg.productId) return cfg.productId;
  const r = await client.req("GET", "/api/catalog/products?size=12", { origin: false });
  const list = res(r.j)?.content ?? [];
  const p = list.find((x) => x.imageUrl) ?? list[0];
  if (!p) throw new Error("no product available in catalog");
  return p.id;
}

/** Two distinct SKUs with enough available stock for the order lifecycle (admin API). */
export async function discoverSkus(admin, need = 2, minAvailable = 3) {
  if (cfg.skuIds.length >= need) return cfg.skuIds.slice(0, need);
  const picked = [];
  // The stock list is not sorted by availability: on the full-size catalog the first SKU with stock can sit past page 190,
  // so walk every page (bounded by the reported totalPages) instead of a fixed 30.
  let totalPages = 500;
  for (let page = 0; page < totalPages && picked.length < need; page++) {
    const r = await admin.req("GET", `/api/admin/stock?page=${page}&size=50`);
    const rows = res(r.j)?.content ?? [];
    if (Number.isInteger(res(r.j)?.totalPages)) totalPages = Math.min(res(r.j).totalPages, 500);
    if (!rows.length) break;
    for (const x of rows) if ((x.availableStock ?? 0) >= minAvailable && picked.length < need) picked.push(x.skuId);
  }
  if (picked.length < need) throw new Error(`need ${need} SKUs with availableStock>=${minAvailable}`);
  return picked;
}

/** SKUs the receipt/stocktake forms can actually select: those forms load only the first 50 stock rows (page=0&size=50). */
export async function discoverUiSkus(admin, need = 2) {
  if (cfg.skuIds.length >= need) return cfg.skuIds.slice(0, need);
  const r = await admin.req("GET", "/api/admin/stock?page=0&size=50");
  const rows = (res(r.j)?.content ?? []).slice(0, need);
  if (rows.length < need) throw new Error(`admin stock list has fewer than ${need} rows`);
  return rows.map((x) => x.skuId);
}
