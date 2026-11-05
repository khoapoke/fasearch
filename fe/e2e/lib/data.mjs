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
  for (let page = 0; page < 30 && picked.length < need; page++) {
    const r = await admin.req("GET", `/api/admin/stock?page=${page}&size=50`);
    const rows = res(r.j)?.content ?? [];
    if (!rows.length) break;
    for (const x of rows) if ((x.availableStock ?? 0) >= minAvailable && picked.length < need) picked.push(x.skuId);
  }
  if (picked.length < need) throw new Error(`need ${need} SKUs with availableStock>=${minAvailable}`);
  return picked;
}
