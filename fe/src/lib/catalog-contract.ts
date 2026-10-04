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
  const match = /^\/catalog\/([^/]+)$/.exec(path);
  if (match) {
    try {
      const productId = decodeURIComponent(match[1]);
      if (/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(productId) && productId !== "drafts") {
        return `/catalog/${encodeURIComponent(productId)}`;
      }
    } catch { /* malformed percent encoding is not a return target */ }
  }
  return "/catalog";
}

/** Parse and sanitize the list view from URL params (invalid → defaults). */
export function parseCatalogView(params: URLSearchParams): {
  category: FashionCategory | null;
  page: number;
  size: number;
} {
  const rawCategory = params.get("category");
  const category =
    rawCategory === "TOP" ||
    rawCategory === "BOTTOM" ||
    rawCategory === "ONE_PIECE"
      ? rawCategory
      : null;
  const boundedInt = (name: string, fallback: number, max: number) => {
    const values = params.getAll(name);
    if (values.length !== 1 || !/^[0-9]+$/.test(values[0])) return fallback;
    const value = Number(values[0]);
    return Number.isSafeInteger(value) && value >= 1 && value <= max ? value : fallback;
  };
  return { category, page: boundedInt("page", 1, 2147483647), size: boundedInt("size", 24, 60) };
}

/** Preserve partial/blank/duplicate expected context so Boot can reject it. */
export function detailContextQuery(params: Pick<URLSearchParams, "getAll">): string {
  const query = new URLSearchParams();
  for (const [source, target] of [["v", "product_version_id"], ["s", "catalog_snapshot_id"]]) {
    for (const value of params.getAll(source)) query.append(target, value);
  }
  return query.toString();
}

export type CatalogAnchor = { productId: string; productVersionId: string; snapshotId: string };
export type ParsedAnchor = { status: "absent" } | { status: "invalid" } | { status: "valid"; reference: CatalogAnchor };

/** A malformed PRODUCT URL never becomes an UPLOAD request by default. */
export function parseCatalogAnchor(params: Pick<URLSearchParams, "getAll">): ParsedAnchor {
  const values = ["anchor_product_id", "anchor_product_version_id", "anchor_catalog_snapshot_id"]
    .map((name) => params.getAll(name));
  if (values.every((value) => value.length === 0)) return { status: "absent" };
  if (values.some((value) => value.length !== 1 || !value[0].trim())) return { status: "invalid" };
  return { status: "valid", reference: { productId: values[0][0], productVersionId: values[1][0], snapshotId: values[2][0] } };
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
