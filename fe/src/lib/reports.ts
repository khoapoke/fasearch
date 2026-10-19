// Pure report helpers — revenue/product/XNT (DECISIONS §8-10).
// Date bounds Asia/Ho_Chi_Minh: [start, next-day-end). Unknown != 0.

export type ReportChannel = "ALL" | "ONLINE" | "POS";

export type ReportFilters = {
  tuNgay: string; // YYYY-MM-DD
  denNgay: string; // YYYY-MM-DD
  kenhBan?: ReportChannel;
  maKho?: string;
  sku?: string;
  topN?: number;
  ngayCham?: string;
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
    throw new Error("TopN phải là số nguyên 1–100.");
  }
  return n;
}

export function buildReportQuery(f: ReportFilters): string {
  const { days: _days } = validateReportRange(f.tuNgay, f.denNgay);
  void _days;
  const q = new URLSearchParams({ tuNgay: f.tuNgay, denNgay: f.denNgay });
  if (f.kenhBan && f.kenhBan !== "ALL") q.set("kenhBan", f.kenhBan);
  if (f.maKho?.trim()) q.set("maKho", f.maKho.trim());
  if (f.sku?.trim()) q.set("maSku", f.sku.trim());
  if (f.topN !== undefined && String(f.topN).trim() !== "") q.set("topN", String(normalizeTopN(f.topN)));
  if (f.ngayCham?.trim()) {
    const n = Number(f.ngayCham);
    if (!Number.isInteger(n) || n < 1) throw new Error("Số ngày chậm phải là số nguyên ≥ 1.");
    q.set("ngayCham", String(n));
  }
  if (f.page !== undefined || f.size !== undefined) {
    q.set("page", String(Math.max(0, Math.floor(f.page ?? 0))));
    q.set("size", String(Math.min(100, Math.max(1, Math.floor(f.size ?? 20)))));
  }
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
