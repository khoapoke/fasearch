/**
 * R2: exact price input parsing + axis validation (pure, tested).
 * Policy (per Control R2): exact inputs accept plain VND digits and the
 * deliberate thousand separators (space, ".", ","); anything else
 * (letters, "-", decimals, unsafe-huge) is INVALID — never silently
 * converted. Values must lie inside the known axis extent; blank means
 * unbounded. Thumbs never leave the track (visual clamps; query keeps
 * exact committed values only when valid).
 */

export type ExactParse =
  | { kind: "blank" }
  | { kind: "value"; value: number }
  | { kind: "invalid" };

const UNSAFE_CAP = 99_999_999;

/** Parse one exact price field. Empty/whitespace-only = intentional blank. */
export function parseExactPrice(raw: string): ExactParse {
  const trimmed = raw.trim();
  if (trimmed === "") return { kind: "blank" };
  // Plain digits, or digits with deliberate thousand separators (space/dot/comma
  // grouping exactly 3). "2.5"/"1,5" fail the group rule; "-100"/"abc" fail the charset.
  if (!/^[0-9][0-9\s.,]*$/.test(trimmed)) return { kind: "invalid" };
  if (/[\s.,]/.test(trimmed)) {
    const groups = trimmed.split(/[\s.,]+/);
    if (groups.some((g, i) => (i === 0 ? !/^\d{1,3}$/.test(g) : !/^\d{3}$/.test(g)))) return { kind: "invalid" };
  }
  const digits = trimmed.replace(/[\s.,]/g, "");
  const n = Number(digits);
  if (!Number.isSafeInteger(n) || n > UNSAFE_CAP) return { kind: "invalid" };
  return { kind: "value", value: n };
}

export type BoundsError = "minMaxOrder" | "outOfAxis";

/**
 * Validate a committed pair. axis null = extent unknown (no axis check;
 * server stays the backstop). Returns the error key or null when OK.
 */
export function validatePriceBounds(
  lo: number | null,
  hi: number | null,
  axisMin: number | null,
  axisMax: number | null,
): BoundsError | null {
  if (lo !== null && hi !== null && lo > hi) return "minMaxOrder";
  if (axisMin !== null && axisMax !== null) {
    if ((lo !== null && (lo < axisMin || lo > axisMax)) || (hi !== null && (hi < axisMin || hi > axisMax))) {
      return "outOfAxis";
    }
  }
  return null;
}

export function boundsErrorText(code: BoundsError, axisMin: number | null, axisMax: number | null): string {
  if (code === "minMaxOrder") return "Giá từ phải nhỏ hơn hoặc bằng giá đến.";
  const fmt = (n: number | null) => (n === null ? "?" : n.toLocaleString("vi-VN") + " ₫");
  return `Giá phải trong khoảng ${fmt(axisMin)} – ${fmt(axisMax)} của danh mục.`;
}
