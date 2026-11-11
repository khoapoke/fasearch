/**
 * Shared display formatting for the admin console.
 * Dates: dd/MM/yyyy HH:mm (Vietnam time), never ISO and never seconds.
 * Money: vi-VN grouping with up to two decimals and one VND unit.
 * Counts: vi-VN grouping with no decimals.
 */

const TIME_ZONE = "Asia/Ho_Chi_Minh";

const NUMERIC = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/;

type Parts = { day: string; month: string; year: string; hour: string | null; minute: string | null };

function partsOf(value: string): Parts | null {
  const match = NUMERIC.exec(value);
  if (match && !HAS_ZONE.test(value)) {
    return { year: match[1], month: match[2], day: match[3], hour: match[4] ?? null, minute: match[5] ?? null };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(parsed)) bag[part.type] = part.value;
  return { year: bag.year, month: bag.month, day: bag.day, hour: bag.hour ?? null, minute: bag.minute ?? null };
}

/** dd/MM/yyyy, or the original value when it is not a date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const p = partsOf(value);
  return p ? `${p.day}/${p.month}/${p.year}` : value;
}

/** dd/MM/yyyy HH:mm, no seconds and no ISO. Falls back to the date alone. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const p = partsOf(value);
  if (!p) return value;
  const date = `${p.day}/${p.month}/${p.year}`;
  return p.hour && p.minute ? `${date} ${p.hour}:${p.minute}` : date;
}

/** 1234567.5 -> "1.234.567,5"; 2000 -> "2.000". */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

/** "2.141.898,31 VND" — one money format for the whole console. */
export function formatMoney(value: number | null | undefined): string {
  const number = formatNumber(value);
  return number ? `${number} VND` : "";
}

/** Money amount without the unit, for cells that render VND separately. */
export function formatAmount(value: number | null | undefined): string {
  return formatNumber(value) || "0";
}

/** Visible placeholder for an empty field, so rows do not read as "—". */
export const EMPTY = "Chưa có";
