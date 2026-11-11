// Report adapters — BE CONTRACT v1 shapes (S2, ADMIN-only narrow BFFs).
// No mocks; nulls (totalCogs/grossProfit/openingStock) pass through honestly.

export type RevenuePoint = { date: string; revenue: number; orders: number };
export type RevenueSummary = {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number | null;
  totalCogs: null;
  grossProfit: null;
};
export type RevenueCoverage = {
  paidInvoices?: number | null;
  excludedPending?: number | null;
  excludedCancelledUnpaid?: number | null;
  softDeletedProductsAttributed?: boolean | null;
  channelNote?: string | null;
  cogsNote?: string | null;
};
export type RevenueResult = { summary: RevenueSummary; timeline: RevenuePoint[]; coverage: RevenueCoverage };

export type TopProductRow = {
  rank: number;
  productId: number;
  productName: string;
  categoryName: string | null;
  totalQuantitySold: number;
  totalRevenue: number;
  currentInventory: number | null;
};

export type MovementRow = {
  skuId: number;
  productName: string;
  color: string | null;
  size: string | null;
  barcode: string | null;
  openingStock: null;
  totalImport: number | null;
  totalSold: number;
  totalDamaged: number | null;
  closingStock: number | null;
};
export type MovementResult = {
  items: MovementRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  coverage: Record<string, unknown>;
};

class ReportError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ReportError";
    this.status = status;
  }
}

async function callAdmin<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  let envelope: { success?: boolean; message?: string; result?: unknown } | null = null;
  try {
    envelope = (await response.json()) as { success?: boolean; message?: string; result?: unknown };
  } catch {
    throw new ReportError(`Phản hồi báo cáo không đúng định dạng (HTTP ${response.status}).`, response.status || 502);
  }
  if (!response.ok || envelope?.success !== true || envelope.result === undefined) {
    const err = new ReportError(envelope?.message || `Không tải được báo cáo (HTTP ${response.status}).`, response.status || 502);
    throw err;
  }
  return envelope.result as T;
}

function req<T>(v: unknown, ok: (x: unknown) => x is T, what: string): T {
  if (!ok(v)) throw new ReportError(`Phản hồi báo cáo không đúng định dạng (${what}).`, 502);
  return v;
}
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : isNum(v) ? v : NaN);
const strOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : isStr(v) ? v : "");

function normSummary(raw: unknown): RevenueSummary {
  const v = req(raw, isObj, "summary");
  return {
    totalRevenue: req(v.totalRevenue, isNum, "totalRevenue"),
    totalOrders: req(v.totalOrders, isNum, "totalOrders"),
    averageOrderValue: numOrNull(v.averageOrderValue),
    totalCogs: null,
    grossProfit: null,
  };
}

function normPoint(raw: unknown): RevenuePoint {
  const v = req(raw, isObj, "timeline[]");
  return { date: req(v.date, isStr, "date"), revenue: req(v.revenue, isNum, "revenue"), orders: req(v.orders, isNum, "orders") };
}

export async function fetchRevenue(query: string): Promise<RevenueResult> {
  const result = await callAdmin<unknown>(`/api/admin/reports/revenue?${query}`);
  const v = req(result, isObj, "revenue");
  if (!Array.isArray(v.timeline)) throw new ReportError("Phản hồi báo cáo không đúng định dạng (timeline).", 502);
  return { summary: normSummary(v.summary), timeline: v.timeline.map(normPoint), coverage: isObj(v.coverage) ? (v.coverage as RevenueCoverage) : {} };
}

export async function fetchTopProducts(query: string): Promise<TopProductRow[]> {
  const result = await callAdmin<unknown>(`/api/admin/reports/top-products?${query}`);
  if (!Array.isArray(result)) throw new ReportError("Phản hồi báo cáo không đúng định dạng (top-products).", 502);
  return result.map((raw) => {
    const v = req(raw, isObj, "top-products[]");
    return {
      rank: req(v.rank, isNum, "rank"),
      productId: req(v.productId, isNum, "productId"),
      productName: req(v.productName, isStr, "productName"),
      categoryName: strOrNull(v.categoryName),
      totalQuantitySold: req(v.totalQuantitySold, isNum, "totalQuantitySold"),
      totalRevenue: req(v.totalRevenue, isNum, "totalRevenue"),
      currentInventory: numOrNull(v.currentInventory),
    };
  });
}

export async function fetchMovement(query: string): Promise<MovementResult> {
  const result = await callAdmin<unknown>(`/api/admin/reports/inventory-movement?${query}`);
  const v = req(result, isObj, "movement");
  const content = (v as { content?: unknown }).content;
  if (!Array.isArray(content)) throw new ReportError("Phản hồi báo cáo không đúng định dạng (content).", 502);
  const items = content.map((raw) => {
    const r = req(raw, isObj, "movement[]");
    return {
      skuId: req(r.skuId, isNum, "skuId"),
      productName: req(r.productName, isStr, "productName"),
      color: strOrNull(r.color),
      size: strOrNull(r.size),
      barcode: strOrNull(r.barcode),
      openingStock: null as null,
      totalImport: numOrNull(r.totalImport),
      totalSold: req(r.totalSold, isNum, "totalSold"),
      totalDamaged: numOrNull(r.totalDamaged),
      closingStock: numOrNull(r.closingStock),
    };
  });
  const page = (v as { pageNumber?: unknown }).pageNumber;
  return {
    items,
    page: typeof page === "number" && Number.isInteger(page) ? page : 0,
    size: typeof (v as { pageSize?: unknown }).pageSize === "number" ? (v as { pageSize: number }).pageSize : items.length,
    totalElements: typeof (v as { totalElements?: unknown }).totalElements === "number" ? (v as { totalElements: number }).totalElements : items.length,
    totalPages: typeof (v as { totalPages?: unknown }).totalPages === "number" ? (v as { totalPages: number }).totalPages : 1,
    coverage: isObj((v as { coverage?: unknown }).coverage) ? ((v as { coverage: Record<string, unknown> }).coverage) : {},
  };
}

/** Neutralize spreadsheet formula injection in text; numbers stay numbers. Exported for unit proof. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + lines], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return filename;
}
