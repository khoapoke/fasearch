// "Tổng hợp" report tab: types, client calls and pure helpers (date presets, comparison, labels).
// Definitions are documented in be_docs/api/api-analytics.md section 4.

export type OverviewKpi = { revenue: number; orders: number; averageOrderValue: number; newCustomers: number };
export type CategoryRevenue = { categoryId: number | null; categoryName: string; revenue: number; quantity: number };
export type StatusCount = { status: string; orders: number; total: number };
export type PaymentSlice = { method: string; invoices: number; revenue: number };
export type TopCustomer = { customerId: number; name: string; deleted: boolean; orders: number; revenue: number; lastOrderAt: string | null };
export type Overview = {
  kpi: OverviewKpi;
  byCategory: CategoryRevenue[];
  byStatus: StatusCount[];
  byPayment: PaymentSlice[];
  topCustomers: TopCustomer[];
};
export type StockHealth = { totalSkus: number; outOfStock: number; lowStock: number; healthyStock: number };

export class OverviewError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OverviewError";
    this.status = status;
  }
}

async function call<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { cache: "no-store", signal });
  let envelope: { success?: boolean; message?: string; result?: unknown } | null = null;
  try {
    envelope = await response.json();
  } catch {
    throw new OverviewError(`Phản hồi Report không đúng định dạng (HTTP ${response.status}).`, response.status || 502);
  }
  if (!response.ok || envelope?.success !== true || envelope.result === undefined || envelope.result === null) {
    throw new OverviewError(envelope?.message || `Không tải được Report (HTTP ${response.status}).`, response.status || 502);
  }
  return envelope.result as T;
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const list = <T,>(v: unknown, map: (x: Record<string, unknown>) => T): T[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object").map(map) : [];

export async function fetchOverview(from: string, to: string, signal?: AbortSignal): Promise<Overview> {
  const raw = await call<Record<string, unknown>>(`/api/admin/reports/overview?${new URLSearchParams({ startDate: from, endDate: to })}`, signal);
  const k = (raw.kpi ?? {}) as Record<string, unknown>;
  return {
    kpi: { revenue: n(k.revenue), orders: n(k.orders), averageOrderValue: n(k.averageOrderValue), newCustomers: n(k.newCustomers) },
    byCategory: list(raw.byCategory, (x) => ({ categoryId: x.categoryId == null ? null : n(x.categoryId), categoryName: String(x.categoryName ?? "Chưa phân loại"), revenue: n(x.revenue), quantity: n(x.quantity) })),
    byStatus: list(raw.byStatus, (x) => ({ status: String(x.status ?? ""), orders: n(x.orders), total: n(x.total) })),
    byPayment: list(raw.byPayment, (x) => ({ method: String(x.method ?? "OTHER"), invoices: n(x.invoices), revenue: n(x.revenue) })),
    topCustomers: list(raw.topCustomers, (x) => ({ customerId: n(x.customerId), name: String(x.name ?? "").trim(), deleted: x.deleted === true, orders: n(x.orders), revenue: n(x.revenue), lastOrderAt: typeof x.lastOrderAt === "string" ? x.lastOrderAt : null })),
  };
}

export async function fetchStockHealth(signal?: AbortSignal): Promise<StockHealth> {
  const r = await call<Record<string, unknown>>("/api/admin/stock-summary?limit=1", signal);
  return { totalSkus: n(r.totalSkus), outOfStock: n(r.outOfStock), lowStock: n(r.lowStock), healthyStock: n(r.healthyStock) };
}

// ---------------------------------------------------------------- dates (Vietnam calendar)

const TZ = "Asia/Ho_Chi_Minh";
const fmtIso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export const todayIso = () => fmtIso(new Date());

/** Adds days to a YYYY-MM-DD date without any time-zone drift. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export type PresetId = "today" | "7" | "30" | "month" | "last-month" | "custom";

export const REPORT_PRESETS: Array<{ id: Exclude<PresetId, "custom">; label: string; range: (today?: string) => [string, string] }> = [
  { id: "today", label: "Hôm nay", range: (t = todayIso()) => [t, t] },
  { id: "7", label: "7 ngày", range: (t = todayIso()) => [addDays(t, -6), t] },
  { id: "30", label: "30 ngày", range: (t = todayIso()) => [addDays(t, -29), t] },
  { id: "month", label: "Tháng này", range: (t = todayIso()) => [`${t.slice(0, 7)}-01`, t] },
  {
    id: "last-month",
    label: "Tháng trước",
    range: (t = todayIso()) => {
      const first = `${t.slice(0, 7)}-01`;
      const last = addDays(first, -1);
      return [`${last.slice(0, 7)}-01`, last];
    },
  },
];

export function presetOf(from: string, to: string, today = todayIso()): PresetId {
  return REPORT_PRESETS.find((p) => { const [a, b] = p.range(today); return a === from && b === to; })?.id ?? "custom";
}

/** The period of the same length immediately before [from, to]. */
export function previousRange(from: string, to: string): [string, string] {
  const len = daysBetween(from, to) + 1;
  return [addDays(from, -len), addDays(from, -1)];
}

// ---------------------------------------------------------------- comparison

export type Delta = { kind: "up" | "down" | "flat" | "none"; pct: number | null; text: string };

/** Percent change vs the previous period. Never divides by zero: previous = 0 gives "none". */
export function computeDelta(current: number, previous: number | null | undefined): Delta {
  if (previous === null || previous === undefined || !Number.isFinite(previous) || previous === 0) {
    return { kind: "none", pct: null, text: previous === 0 ? "Kỳ trước chưa có" : "" };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) return { kind: "flat", pct: 0, text: "0%" };
  const abs = Math.abs(rounded).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  return { kind: rounded > 0 ? "up" : "down", pct: rounded, text: `${abs}%` };
}

// ---------------------------------------------------------------- labels

export const ORDER_STATUS: Array<{ status: string; label: string; tone: "blue" | "violet" | "amber" | "cyan" | "green" | "red" | "orange" }> = [
  { status: "PENDING", label: "Mới tạo", tone: "blue" },
  { status: "CONFIRMED", label: "Đã xác nhận", tone: "violet" },
  { status: "PACKING", label: "Đang đóng gói", tone: "amber" },
  { status: "SHIPPING", label: "Đang giao", tone: "cyan" },
  { status: "COMPLETED", label: "Hoàn thành", tone: "green" },
  { status: "CANCELLED", label: "Đã hủy", tone: "red" },
  { status: "RETURNED", label: "Trả hàng", tone: "orange" },
];

export function paymentLabel(code: string): string {
  const c = code.toUpperCase();
  if (c === "CASH" || c === "COD") return "Tiền mặt";
  if (c === "STRIPE") return "Stripe";
  if (c === "VNPAY" || c === "VNPAY_QR") return "VNPay";
  return "Khác";
}

/** Groups API rows into at most `max` slices; method codes with the same label merge, the rest fold into "Khác". */
export function groupPayments(rows: PaymentSlice[], max = 5): PaymentSlice[] {
  const merged = new Map<string, PaymentSlice>();
  for (const r of rows) {
    const label = paymentLabel(r.method);
    const cur = merged.get(label) ?? { method: label, invoices: 0, revenue: 0 };
    cur.invoices += r.invoices;
    cur.revenue += r.revenue;
    merged.set(label, cur);
  }
  const all = [...merged.values()].sort((a, b) => (a.method === "Khác" ? 1 : b.method === "Khác" ? -1 : b.revenue - a.revenue));
  if (all.length <= max) return all;
  const head = all.filter((s) => s.method !== "Khác").slice(0, max - 1);
  const rest = all.filter((s) => !head.includes(s));
  return [...head, { method: "Khác", invoices: rest.reduce((s, r) => s + r.invoices, 0), revenue: rest.reduce((s, r) => s + r.revenue, 0) }];
}

/** Top `max` categories plus one "Khác" row for the remainder. */
export function topCategories(rows: CategoryRevenue[], max = 8): CategoryRevenue[] {
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
  if (sorted.length <= max) return sorted;
  const rest = sorted.slice(max);
  return [...sorted.slice(0, max), { categoryId: null, categoryName: "Khác", revenue: rest.reduce((s, r) => s + r.revenue, 0), quantity: rest.reduce((s, r) => s + r.quantity, 0) }];
}
