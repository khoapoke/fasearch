// "Sản phẩm đã xem gần đây": localStorage only, newest first, max 12, works logged out.
export const RECENT_KEY = "fa-recently-viewed-v1";
export const RECENT_MAX = 12;
export const RECENT_EVENT = "fa:recent-changed";

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(RECENT_EVENT));
}

export type RecentItem = { id: number; name: string; price: number; image?: string; href: string };

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function valid(item: unknown): item is RecentItem {
  if (!item || typeof item !== "object") return false;
  const r = item as Record<string, unknown>;
  return typeof r.id === "number" && Number.isSafeInteger(r.id) && r.id > 0
    && typeof r.name === "string" && r.name.length > 0
    && typeof r.price === "number" && Number.isFinite(r.price)
    && typeof r.href === "string" && r.href.startsWith("/san-pham/")
    && (r.image === undefined || typeof r.image === "string");
}

export function readRecent(storage?: StorageLike | null): RecentItem[] {
  try {
    const store = storage ?? (typeof window === "undefined" ? null : window.localStorage);
    const raw = store?.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<number>();
    const out: RecentItem[] = [];
    for (const item of parsed) {
      if (valid(item) && !seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
      if (out.length >= RECENT_MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Pure: put `item` first, drop duplicates, cap at RECENT_MAX. */
export function pushRecent(list: RecentItem[], item: RecentItem): RecentItem[] {
  return [item, ...list.filter((entry) => entry.id !== item.id)].slice(0, RECENT_MAX);
}

export function recordRecent(item: RecentItem, storage?: StorageLike | null): RecentItem[] {
  const next = pushRecent(readRecent(storage), item);
  try {
    const store = storage ?? (typeof window === "undefined" ? null : window.localStorage);
    store?.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* private mode / quota: the rail simply stays empty */ }
  notify();
  return next;
}

export function clearRecent(storage?: StorageLike | null) {
  try {
    const store = (storage ?? (typeof window === "undefined" ? null : window.localStorage)) as Storage | null;
    store?.setItem(RECENT_KEY, "[]");
  } catch { /* ignore */ }
  notify();
}
