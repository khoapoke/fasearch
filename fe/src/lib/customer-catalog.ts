// Typed client adapter for the public re teammate BE catalog (pinned 283503f).
// UI receives only normalized fields; upstream envelopes/paging never leak into components.

export type CatalogCategory = { id: number; name: string };

export type CatalogProduct = {
  id: number;
  name: string;
  categoryId: number | null;
  categoryName: string | null;
  material: string | null;
  style: string | null;
  price: number;
  imageUrl: string | null;
  status: string | null;
  /** Nhãn hiệu là metadata/lexical từ DB; không phải suy luận từ ảnh. */
  brandName: string | null;
  brandSlug: string | null;
  /** First-party provenance snapshot; present only for rows imported from a verified feed. */
  sourceHost: string | null;
  sourceUrl: string | null;
  sourceBrand: string | null;
  curationClass: string | null;
};

export type CatalogVariant = {
  skuId: number;
  productId: number;
  color: string | null;
  size: string | null;
  additionalPrice: number;
};

export type CatalogProductDetail = CatalogProduct & {
  description: string | null;
  variants: CatalogVariant[];
};

export type CatalogPage = {
  items: CatalogProduct[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  isLast: boolean;
};

export type CatalogQuery = {
  keyword?: string;
  brand?: string;
  categoryId?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  page: number;
  size: number;
  sort: string;
};

export type CatalogSort =
  | "id,desc"
  | "price,asc"
  | "price,desc"
  | "productName,asc"
  | "productName,desc";

export class CatalogError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CatalogError";
    this.status = status;
  }
}

type Envelope<T> = { success?: boolean; code?: number; message?: string; result?: T };

const SORTS: CatalogSort[] = ["id,desc", "price,asc", "price,desc", "productName,asc", "productName,desc"];

const INVALID_DATA = "Dữ liệu danh mục từ máy chủ không hợp lệ. Thử lại.";

function requireInteger(value: unknown, minimum = 0): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw new CatalogError(INVALID_DATA, 502);
  }
  return value;
}

function requireFinite(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CatalogError(INVALID_DATA, 502);
  }
  return value;
}

function normalizeProduct(raw: unknown): CatalogProduct {
  if (!raw || typeof raw !== "object") throw new CatalogError(INVALID_DATA, 502);
  const p = raw as Record<string, unknown>;
  const name = typeof p.productName === "string" ? p.productName.trim() : "";
  if (!name) throw new CatalogError(INVALID_DATA, 502);
  return {
    id: requireInteger(p.id, 1),
    name,
    categoryId: p.categoryId === null || p.categoryId === undefined ? null : requireInteger(p.categoryId, 1),
    categoryName: typeof p.categoryName === "string" ? p.categoryName : null,
    material: typeof p.material === "string" ? p.material : null,
    style: typeof p.style === "string" ? p.style : null,
    price: requireFinite(p.price),
    brandName: typeof p.brandName === "string" && p.brandName ? p.brandName : null,
    brandSlug: typeof p.brandSlug === "string" && p.brandSlug ? p.brandSlug : null,
    sourceHost: typeof p.sourceHost === "string" && p.sourceHost ? p.sourceHost : null,
    sourceUrl: (() => {
      const raw = typeof p.sourceUrl === "string" ? p.sourceUrl : null;
      // Only absolute http(s) provenance links leave the site.
      return raw && /^https:\/\//.test(raw) ? raw : null;
    })(),
    sourceBrand: typeof p.sourceBrand === "string" && p.sourceBrand ? p.sourceBrand : null,
    curationClass: typeof p.curationClass === "string" && p.curationClass ? p.curationClass : null,
    imageUrl: (() => {
      const raw = typeof p.imageUrl === "string" && p.imageUrl ? p.imageUrl : null;
      if (!raw) return null;
      const m = raw.match(/^\/api\/v1\/products\/images\/(.+)$/);
      return m ? `/api/catalog/product-images/${m[1]}` : raw;
    })(),
    status: typeof p.status === "string" ? p.status : null,
  };
}

function normalizeVariant(raw: unknown): CatalogVariant {
  if (!raw || typeof raw !== "object") throw new CatalogError(INVALID_DATA, 502);
  const v = raw as Record<string, unknown>;
  return {
    skuId: requireInteger(v.skuId, 1),
    productId: requireInteger(v.productId, 1),
    color: typeof v.color === "string" ? v.color : null,
    size: typeof v.size === "string" ? v.size : null,
    // BE cho phép additionalPrice null; null/absent = 0 surcharge. Any other
    // non-number value is malformed, never silently turned into 0.
    additionalPrice: v.additionalPrice === null || v.additionalPrice === undefined ? 0 : requireFinite(v.additionalPrice),
  };
}

function normalizePage(result: unknown, fallbackSize: number): CatalogPage {
  if (!result || typeof result !== "object") throw new CatalogError(INVALID_DATA, 502);
  const page = result as Record<string, unknown>;
  if (!Array.isArray(page.content) || typeof page.last !== "boolean") {
    throw new CatalogError(INVALID_DATA, 502);
  }
  return {
    items: page.content.map(normalizeProduct),
    page: requireInteger(page.pageNumber),
    size: page.pageSize === undefined ? fallbackSize : requireInteger(page.pageSize, 1),
    totalElements: requireInteger(page.totalElements),
    totalPages: requireInteger(page.totalPages),
    isLast: page.last,
  };
}

async function readEnvelope<T>(response: Response): Promise<T> {
  let payload: Envelope<T> | null = null;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    throw new CatalogError("Máy chủ danh mục trả về không đúng định dạng.", response.status || 502);
  }
  if (!response.ok || !payload || payload.success !== true || payload.result === undefined) {
    throw new CatalogError(
      payload?.message || (response.status === 404 ? "Không tìm thấy sản phẩm." : "Không tải được dữ liệu danh mục."),
      response.status || 502,
    );
  }
  return payload.result;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal, headers: { accept: "application/json" } });
  return readEnvelope<T>(response);
}

export async function fetchCatalogCategories(signal?: AbortSignal): Promise<CatalogCategory[]> {
  const result = await getJson<unknown>("/api/catalog/categories", signal);
  if (!Array.isArray(result)) throw new CatalogError("Danh mục không đúng định dạng.", 502);
  return result.map((item) => {
    if (!item || typeof item !== "object") throw new CatalogError("Danh mục không đúng định dạng.", 502);
    const row = item as Record<string, unknown>;
    const name = typeof row.categoryName === "string" ? row.categoryName.trim() : "";
    if (!name) throw new CatalogError("Danh mục không đúng định dạng.", 502);
    return { id: requireInteger(row.id, 1), name };
  });
}

export function buildCatalogQuery(query: CatalogQuery): string {
  const params = new URLSearchParams();
  if (query.keyword?.trim()) params.set("keyword", query.keyword.trim());
  if (query.brand?.trim()) params.set("brand", query.brand.trim());
  if (query.categoryId != null && Number.isFinite(query.categoryId)) params.set("categoryId", String(query.categoryId));
  if (query.minPrice != null && Number.isFinite(query.minPrice)) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice != null && Number.isFinite(query.maxPrice)) params.set("maxPrice", String(query.maxPrice));
  params.set("page", String(Math.max(0, Math.trunc(query.page))));
  params.set("size", String(Math.min(24, Math.max(1, Math.trunc(query.size)))));
  const sort = SORTS.includes(query.sort as CatalogSort) ? query.sort : "id,desc";
  params.set("sort", sort);
  return params.toString();
}

export async function fetchCatalogProducts(query: CatalogQuery, signal?: AbortSignal): Promise<CatalogPage> {
  const result = await getJson<unknown>(`/api/catalog/products?${buildCatalogQuery(query)}`, signal);
  return normalizePage(result, query.size);
}

export async function fetchCatalogProduct(id: string, signal?: AbortSignal): Promise<CatalogProductDetail> {
  const result = await getJson<Record<string, unknown>>(
    `/api/catalog/products/${encodeURIComponent(id)}`,
    signal,
  );
  const base = normalizeProduct(result);
  if (result.variants !== null && result.variants !== undefined && !Array.isArray(result.variants)) {
    throw new CatalogError(INVALID_DATA, 502);
  }
  const variants = Array.isArray(result.variants) ? result.variants.map(normalizeVariant) : [];
  return {
    ...base,
    description: typeof result.description === "string" ? result.description : null,
    variants,
  };
}

export function formatVnd(value: number): string {
  return Number.isFinite(value) ? `${value.toLocaleString("vi-VN")} ₫` : "—";
}


export type CatalogBrand = { id: number; name: string; slug: string; logoUrl: string | null; country: string | null };

/** `GET /api/v1/brands` — công khai trên catalog candidate; rỗng khi chưa import. */
export async function fetchCatalogBrands(signal?: AbortSignal): Promise<CatalogBrand[]> {
  const result = await getJson<unknown>("/api/catalog/brands", signal);
  const list = Array.isArray(result) ? result : [];
  return list.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const b = raw as Record<string, unknown>;
    if (!Number.isSafeInteger(b.id) || typeof b.name !== "string" || typeof b.slug !== "string") return [];
    return [{ id: b.id as number, name: b.name, slug: b.slug, logoUrl: typeof b.logoUrl === "string" ? b.logoUrl : null, country: typeof b.country === "string" ? b.country : null }];
  });
}
