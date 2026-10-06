// Pure personal-library helpers: id/mode/page validation mirrors plus href
// builders and history grouping. The backend stays authoritative; these only
// give fast, friendly feedback before a request is sent.

const PRODUCT_ID = /^[A-Za-z0-9_.-]{1,128}$/;

export const LIBRARY_MODES = ["IMAGE", "TEXT", "COMPOSED"] as const;
export type LibraryMode = (typeof LIBRARY_MODES)[number];

export function validProductId(raw: string | null | undefined): boolean {
  return typeof raw === "string" && PRODUCT_ID.test(raw);
}

export function parseLibraryMode(raw: string | null): LibraryMode | null {
  if (!raw) return null;
  return (LIBRARY_MODES as readonly string[]).includes(raw) ? (raw as LibraryMode) : null;
}

export function parseLibraryPage(params: URLSearchParams): { page: number; size: number } {
  const page = Number(params.get("page") ?? "1");
  const size = Number(params.get("size") ?? "20");
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    size: Number.isInteger(size) && size >= 1 && size <= 100 ? size : 20,
  };
}

export interface SavedListItem {
  product_id: string;
  saved_at: string;
  available: boolean;
  product: {
    product_id: string;
    product_version_id: string;
    title: string;
    category: string;
    image_url: string;
  } | null;
}

export interface HistoryListItem {
  id: string;
  mode: LibraryMode;
  query_text: string | null;
  result_count: number;
  catalog_snapshot_id: string;
  model_version: string;
  index_version: string;
  result_refs: Array<{ product_id: string; product_version_id: string; rank: number }>;
  trace_id: string;
  created_at: string;
}

export function modeLabel(mode: LibraryMode): string {
  switch (mode) {
    case "IMAGE":
      return "Ảnh";
    case "TEXT":
      return "Chữ";
    case "COMPOSED":
      return "Kết hợp";
  }
}

// Chronological day groups, newest first. Labels are computed by the caller
// from the group key (YYYY-MM-DD) so tests stay timezone-stable.
export function groupHistoryByDay(items: HistoryListItem[]): Array<{ day: string; items: HistoryListItem[] }> {
  const groups = new Map<string, HistoryListItem[]>();
  for (const item of items) {
    const day = item.created_at.slice(0, 10);
    const bucket = groups.get(day);
    if (bucket) bucket.push(item);
    else groups.set(day, [item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, dayItems]) => ({ day, items: dayItems }));
}

export function textResearchHref(queryText: string): string {
  return `/search/text?q=${encodeURIComponent(queryText)}`;
}
