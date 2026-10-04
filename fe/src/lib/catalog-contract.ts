import type { FashionCategory, Publication } from "./search-contract";
export interface CatalogItem {
  product_id: string;
  product_version_id: string;
  title: string;
  category: FashionCategory;
  image_url: string;
}

export interface CatalogPageResponse {
  schema_version: "1.0.0";
  trace_id: string;
  publication: Publication;
  artifact_scope: "PILOT_ONLY";
  page: number;
  size: number;
  total: number;
  has_more: boolean;
  items: CatalogItem[];
}

export interface CatalogDetailResponse {
  schema_version: "1.0.0";
  trace_id: string;
  publication: Publication;
  artifact_scope: "PILOT_ONLY";
  product_id: string;
  product_version_id: string;
  title: string;
  category: FashionCategory;
  description: string | null;
  image_url: string;
}

export interface CatalogError {
  schema_version: string;
  trace_id: string | null;
  code: string;
  message: string;
}

/** Allowlisted local return targets for detail back-navigation.
 * Only the path is kept: any caller-supplied query is dropped so untrusted
 * query keys/values cannot ride into catalog/search routes. */
export function safeReturnHref(raw: string | null): string {
  if (!raw) return "/catalog";
  if (!raw.startsWith("/")) return "/catalog";
  if (raw.startsWith("//")) return "/catalog";
  const [path] = raw.split("?", 1);
  if (
    path === "/catalog" ||
    path === "/search/text" ||
    path === "/search/composed" ||
    path === "/"
  ) {
    return path;
  }
  if (/^\/catalog\/[^/]+$/.test(path)) return path;
  return "/catalog";
}

/** Parse and sanitize the list view from URL params (invalid → defaults). */
export function parseCatalogView(params: URLSearchParams): {
  category: FashionCategory | null;
  page: number;
} {
  const rawCategory = params.get("category");
  const category =
    rawCategory === "TOP" ||
    rawCategory === "BOTTOM" ||
    rawCategory === "ONE_PIECE"
      ? rawCategory
      : null;
  const rawPage = Number(params.get("page"));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  return { category, page };
}

/** Exact detail URL carrying version + snapshot from an actual API response. */
export function detailHref(
  productId: string,
  productVersionId: string,
  catalogSnapshotId: string,
): string {
  const params = new URLSearchParams({
    v: productVersionId,
    s: catalogSnapshotId,
  });
  return `/catalog/${encodeURIComponent(productId)}?${params.toString()}`;
}

/** Composed anchor URL for the detail CTA. */
export function composedAnchorHref(
  productId: string,
  productVersionId: string,
  catalogSnapshotId: string,
): string {
  const params = new URLSearchParams({
    anchor_product_id: productId,
    anchor_product_version_id: productVersionId,
    anchor_catalog_snapshot_id: catalogSnapshotId,
  });
  return `/search/composed?${params.toString()}`;
}
