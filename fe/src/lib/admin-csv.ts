/**
 * Pure helpers for the admin CSV exports: query building, file names and the
 * personal-data notice. Kept free of React/DOM so node:test can cover them.
 */

export type CsvDataset = "products" | "stock" | "orders" | "customers";

const DATASET_FILE: Record<CsvDataset, string> = {
  products: "san-pham",
  stock: "ton-kho",
  orders: "don-hang",
  customers: "khach-hang",
};

const MAX_KEYWORD = 100;

function keyword(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_KEYWORD);
}

function put(q: URLSearchParams, key: string, value: string | undefined | null) {
  if (value !== undefined && value !== null && value !== "") q.set(key, value);
}

/** Query for GET /api/admin/csv/products — the same filters as the product list. */
export function productCsvQuery(filters: { keyword?: string; categoryId?: string; status?: string }): string {
  const q = new URLSearchParams();
  const term = keyword(filters.keyword);
  put(q, "keyword", term);
  put(q, "categoryId", filters.categoryId);
  put(q, "status", filters.status);
  return q.toString();
}

/** Query for GET /api/admin/csv/stock — the same filters as the stock list. */
export function stockCsvQuery(filters: { keyword?: string }): string {
  const q = new URLSearchParams();
  put(q, "keyword", keyword(filters.keyword));
  return q.toString();
}

/** Query for GET /api/admin/csv/orders — the same filters as the order list. */
export function orderCsvQuery(filters: { keyword?: string; status?: string; from?: string; to?: string }): string {
  const q = new URLSearchParams();
  put(q, "keyword", keyword(filters.keyword));
  put(q, "status", filters.status);
  put(q, "startDate", filters.from);
  put(q, "endDate", filters.to);
  return q.toString();
}

/** Query for GET /api/admin/csv/customers — the same filters as the customer list. */
export function customerCsvQuery(filters: { keyword?: string }): string {
  const q = new URLSearchParams();
  put(q, "keyword", keyword(filters.keyword));
  return q.toString();
}

/** Fallback only: the server sends the real name. Date and dataset, never personal data. */
export function csvFilename(dataset: CsvDataset, now: Date = new Date()): string {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return `${DATASET_FILE[dataset]}-${date}.csv`;
}

/** Read the server file name, refusing anything with a path or a non-CSV extension. */
export function filenameFromDisposition(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /filename\s*=\s*"?([^";]+)"?/i.exec(value);
  const name = match?.[1]?.trim();
  if (!name || !/^[A-Za-z0-9._-]+\.csv$/.test(name) || name.includes("..")) return null;
  return name;
}

/** The notice shown before a download that contains customers' personal data. */
export function personalDataNotice(dataset: "customers" | "orders"): string {
  if (dataset === "customers") {
    return "Tệp CSV chứa dữ liệu cá nhân của khách hàng: số điện thoại, địa chỉ và ngày sinh. "
      + "Tệp không được lưu trên máy chủ; hãy bảo quản tệp cẩn thận và chỉ chia sẻ với người có trách nhiệm.";
  }
  return "Tệp CSV chứa dữ liệu cá nhân của khách hàng: tên, số điện thoại và địa chỉ giao hàng. "
    + "Tệp không được lưu trên máy chủ; hãy bảo quản tệp cẩn thận và chỉ chia sẻ với người có trách nhiệm.";
}
