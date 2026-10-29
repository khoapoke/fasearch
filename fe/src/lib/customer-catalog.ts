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

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function priceOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeProduct(raw: unknown): CatalogProduct {
  const p = raw as Record<string, unknown>;
  return {
    id: Number(p.id),
    name: typeof p.productName === "string" ? p.productName : "Sản phẩm",
    categoryId: numberOrNull(p.categoryId),
    categoryName: typeof p.categoryName === "string" ? p.categoryName : null,
    material: typeof p.material === "string" ? p.material : null,
    style: typeof p.style === "string" ? p.style : null,
    price: priceOrZero(p.price),
    imageUrl: typeof p.imageUrl === "string" && p.imageUrl ? p.imageUrl : null,
    status: typeof p.status === "string" ? p.status : null,
  };
}

function normalizeVariant(raw: unknown): CatalogVariant {
  const v = raw as Record<string, unknown>;
  return {
    skuId: Number(v.skuId),
    productId: Number(v.productId),
    color: typeof v.color === "string" ? v.color : null,
    size: typeof v.size === "string" ? v.size : null,
    additionalPrice: priceOrZero(v.additionalPrice),
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
    const row = item as Record<string, unknown>;
    return { id: Number(row.id), name: typeof row.categoryName === "string" ? row.categoryName : "Danh mục" };
  });
}

export function buildCatalogQuery(query: CatalogQuery): string {
  const params = new URLSearchParams();
  if (query.keyword?.trim()) params.set("keyword", query.keyword.trim());
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
  const result = await getJson<Record<string, unknown>>(`/api/catalog/products?${buildCatalogQuery(query)}`, signal);
  const content = Array.isArray(result.content) ? result.content : [];
  return {
    items: content.map(normalizeProduct),
    page: Number(result.pageNumber ?? 0),
    size: Number(result.pageSize ?? query.size),
    totalElements: Number(result.totalElements ?? content.length),
    totalPages: Number(result.totalPages ?? 1),
    isLast: Boolean(result.last ?? result.isLast),
  };
}

export async function fetchCatalogProduct(id: string, signal?: AbortSignal): Promise<CatalogProductDetail> {
  const result = await getJson<Record<string, unknown>>(
    `/api/catalog/products/${encodeURIComponent(id)}`,
    signal,
  );
  const base = normalizeProduct(result);
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
