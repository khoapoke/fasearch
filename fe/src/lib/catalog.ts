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

function foldFacet(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0110\u0111]/g, "d")
    .replace(/\s+/g, " ");
}

/**
 * Server facets có thể trả cùng một màu dưới nhiều dạng viết ("DEN" và "Đen").
 * Gộp theo khoá không dấu, giữ đại diện dễ đọc (bản viết thường) và luôn là giá
 * trị server trả về nên vẫn lọc được; thứ tự giữ nguyên của server.
 */
export function dedupeFacetValues(values: string[]): string[] {
  const groups = new Map<string, string>();
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = foldFacet(trimmed);
    const current = groups.get(key);
    if (current === undefined) {
      groups.set(key, trimmed);
      continue;
    }
    const currentShouty = current === current.toUpperCase();
    const candidateShouty = trimmed === trimmed.toUpperCase();
    if (currentShouty && !candidateShouty) groups.set(key, trimmed);
  }
  return [...groups.values()];
}

export type { Page };
export { unwrap };
