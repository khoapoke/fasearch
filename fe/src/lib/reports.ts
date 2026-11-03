// Pure report helpers — revenue/product/movement per BE CONTRACT v1 (S2).
// Date bounds Asia/Ho_Chi_Minh: [start, next-day-end). Unknown != 0.

export type RevenuePeriod = "DAY" | "WEEK" | "MONTH" | "YEAR";

export type TopType = "BEST_SELLER" | "SLOW_MOVING";

export type ReportFilters = {
  tuNgay: string; // YYYY-MM-DD
  denNgay: string; // YYYY-MM-DD
  period?: RevenuePeriod;
  type?: TopType;
  limit?: number;
  month?: string; // MM-YYYY (movement)
  sku?: string;
  page?: number;
  size?: number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const REPORT_MAX_DAYS = 366;

export function validateReportRange(tuNgay: string, denNgay: string): { days: number } {
  if (!DAY.test(tuNgay) || !DAY.test(denNgay)) {
    throw new Error("Ngày phải đúng định dạng YYYY-MM-DD.");
  }
  if (tuNgay > denNgay) throw new Error("Từ ngày phải trước hoặc bằng đến ngày.");
  const days = Math.round((Date.parse(denNgay) - Date.parse(tuNgay)) / 86400000) + 1;
  if (days > REPORT_MAX_DAYS) {
    throw new Error(`Khoảng báo cáo tối đa ${REPORT_MAX_DAYS} ngày. Thu hẹp rồi thử lại.`);
  }
  return { days };
}

export function normalizeTopN(raw: string | number | undefined, def = 10): number {
  if (raw === undefined || raw === null || String(raw).trim() === "") return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new Error("Limit phải là số nguyên 1–100.");
  }
  return n;
}

const MONTH = /^(0[1-9]|1[0-2])-\d{4}$/;

export function normalizeMonth(raw: string | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  if (!MONTH.test(v)) throw new Error("Tháng phải đúng định dạng MM-YYYY.");
  return v;
}

/** Query cho GET /api/admin/reports/revenue (period + HCMC day bounds). */
export function buildRevenueQuery(f: ReportFilters): string {
  validateReportRange(f.tuNgay, f.denNgay);
  const period: RevenuePeriod = f.period ?? "DAY";
  if (!["DAY", "WEEK", "MONTH", "YEAR"].includes(period)) throw new Error("Chu kỳ chưa hợp lệ.");
  return new URLSearchParams({ period, startDate: f.tuNgay, endDate: f.denNgay, channel: "ALL" }).toString();
}

/** Query cho GET /api/admin/reports/top-products. */
export function buildTopQuery(f: ReportFilters): string {
  const type: TopType = f.type ?? "BEST_SELLER";
  if (!(type === "BEST_SELLER" || type === "SLOW_MOVING")) throw new Error("Loại top chưa hợp lệ.");
  const q = new URLSearchParams({ type, limit: String(normalizeTopN(f.limit)) });
  if (f.tuNgay && f.denNgay) {
    validateReportRange(f.tuNgay, f.denNgay);
    q.set("startDate", f.tuNgay);
    q.set("endDate", f.denNgay);
  }
  return q.toString();
}

/** Query cho GET /api/admin/reports/inventory-movement. */
export function buildMovementQuery(f: ReportFilters): string {
  const q = new URLSearchParams({
    page: String(Math.max(0, Math.floor(f.page ?? 0))),
    size: String(Math.min(100, Math.max(1, Math.floor(f.size ?? 20)))),
  });
  const month = normalizeMonth(f.month);
  if (month) q.set("month", month);
  if (f.sku?.trim()) q.set("sku", f.sku.trim().slice(0, 64));
  return q.toString();
}

/** Tên file CSV an toàn, không PII/filter injection. */
export function reportCsvName(kind: "doanh-thu" | "san-pham" | "xuat-nhap-ton", tuNgay: string, denNgay: string): string {
  const safe = (s: string) => s.replace(/[^0-9-]/g, "");
  return `bao-cao-${kind}-${safe(tuNgay)}-${safe(denNgay)}.csv`;
}

export function formatMoneyOrUnknown(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Chưa rõ";
  return `${value.toLocaleString("vi-VN")}₫`;
}
