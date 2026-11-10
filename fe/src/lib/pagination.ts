/**
 * R5-pagination: pure page-window + jump-input helpers (no React/DOM).
 * UI shows 1-based pages; the API stays 0-based — conversion is explicit
 * at the call site, never hidden here.
 */

export type PageToken = { kind: "page"; page: number } | { kind: "gap"; key: string };

const WINDOW_RADIUS = 2;
const EDGE_COUNT = 7;

/**
 * Compact window, max ~7–9 numbers: always first + last, current ± 2,
 * non-focusable gaps where ranges are skipped. Near boundaries the window
 * extends instead of showing redundant ellipses.
 */
export function pageWindow(current: number, total: number): PageToken[] {
  if (total <= EDGE_COUNT) {
    return Array.from({ length: total }, (_, i) => ({ kind: "page", page: i + 1 }) as PageToken);
  }
  const pages = new Set<number>([1, total]);
  const lo = Math.max(1, current - WINDOW_RADIUS);
  const hi = Math.min(total, current + WINDOW_RADIUS);
  for (let p = lo; p <= hi; p++) pages.add(p);
  // Near a boundary, fill up to a full edge run instead of a lone gap.
  if (current <= WINDOW_RADIUS + 2) {
    for (let p = 1; p <= EDGE_COUNT; p++) pages.add(p);
  }
  if (current >= total - WINDOW_RADIUS - 1) {
    for (let p = total - EDGE_COUNT + 1; p <= total; p++) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: PageToken[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev > 0 && p - prev > 1) out.push({ kind: "gap", key: `gap-${prev}-${p}` });
    out.push({ kind: "page", page: p });
    prev = p;
  }
  return out;
}

export type JumpError = "empty" | "nan" | "outOfRange";

/**
 * Validate a jump input against server-derived totalPages.
 * Returns the 1-based page, or an error key the UI maps to Vietnamese copy.
 * Never clamps or guesses — invalid stays invalid with the typed value kept.
 */
export function parseJumpInput(raw: string, totalPages: number): { page?: number; error?: JumpError } {
  const trimmed = raw.trim();
  if (trimmed === "") return { error: "empty" };
  if (!/^\d+$/.test(trimmed)) return { error: "nan" };
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n) || n < 1 || n > totalPages) return { error: "outOfRange" };
  return { page: n };
}

/** Visible "13–18 trên 2195" range from real server metadata (0-based page). */
export function visibleRange(page0: number, size: number, totalElements: number): { from: number; to: number } | null {
  if (totalElements <= 0 || size <= 0) return null;
  const from = page0 * size + 1;
  if (from > totalElements) return null;
  return { from, to: Math.min((page0 + 1) * size, totalElements) };
}
