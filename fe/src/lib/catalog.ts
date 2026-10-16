// Shared global catalog contract consumer
// (stitch-inventory-night-batch/CATALOG_CONTRACT.md).
// Hai chế độ, chọn bằng probe — KHÔNG suy capability từ HTTP 200 của list,
// vì Spring cũ lờ tham số lạ mà vẫn 200:
// - server: BE có `GET v1/catalog/bo-loc` (facets thật) + `kichCo/mauSac/sapXep`
//   cho list. Bỏ toàn bộ lọc/sort client second-pass.
// - local: giữ lọc client trong trang đã tải, UI ghi chú rõ phạm vi.

import { beFetch, unwrap, type Page } from "./mgmt-client.ts";

export type ServerSort = "id-asc" | "price-asc" | "price-desc" | "name-asc";

export type Facets = { mauSac: string[]; kichCo: string[]; truncated: boolean };

export type CatalogCaps = { server: boolean; facets: Facets | null };

let capsCache: CatalogCaps | null = null;

export async function probeCatalogCaps(): Promise<CatalogCaps> {
  if (capsCache) return capsCache;
  try {
    const r = await beFetch("v1/catalog/bo-loc");
    if (!r.ok) {
      capsCache = { server: false, facets: null };
      return capsCache;
    }
    const f = await unwrap<Facets>(r);
    if (!Array.isArray(f.mauSac) || !Array.isArray(f.kichCo)) throw new Error("facets shape");
    capsCache = { server: true, facets: f };
  } catch {
    capsCache = { server: false, facets: null };
  }
  return capsCache;
}

export function resetCatalogCaps() {
  capsCache = null;
}

export type CatalogQuery = {
  q: string;
  maDanhMuc: string;
  giaTu: string;
  giaDen: string;
  kichCo: string;
  mauSac: string;
  sapXep: string;
  page: number;
  size: number;
};

export function catalogQueryString(query: CatalogQuery, server: boolean): string {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size) });
  if (query.q) params.set("q", query.q);
  if (query.maDanhMuc) params.set("maDanhMuc", query.maDanhMuc);
  if (query.giaTu) params.set("giaTu", query.giaTu);
  if (query.giaDen) params.set("giaDen", query.giaDen);
  if (server) {
    if (query.kichCo) params.set("kichCo", query.kichCo);
    if (query.mauSac) params.set("mauSac", query.mauSac);
    if (query.sapXep) params.set("sapXep", query.sapXep);
  }
  return params.toString();
}

export function facetsQueryString(query: Pick<CatalogQuery, "q" | "maDanhMuc" | "giaTu" | "giaDen">): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.maDanhMuc) params.set("maDanhMuc", query.maDanhMuc);
  if (query.giaTu) params.set("giaTu", query.giaTu);
  if (query.giaDen) params.set("giaDen", query.giaDen);
  return params.toString();
}

export type { Page };
export { unwrap };
