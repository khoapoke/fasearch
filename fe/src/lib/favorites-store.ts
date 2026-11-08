// Server-backed favorites store for catalog cards. Replaces localStorage source of truth.
// Per-account; cache is cleared on logout/login so accounts don't share state.

import { addFavorite, fetchFavorites, removeFavorite } from "@/lib/customer-account-client";

/** Broadcast on every successful toggle so hearts for the same product stay in sync. */
export const FAVORITE_EVENT = "fa:favorite";
export type FavoriteChange = { id: number; loved: boolean };

let cachedIds: Set<number> | null = null;
let loadingPromise: Promise<Set<number>> | null = null;
let authed = false;

export async function loadFavoriteIds(): Promise<Set<number>> {
  if (cachedIds) return cachedIds;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      const pg = await fetchFavorites(0, 1000);
      const ids = new Set(pg.data.map((f) => f.productId));
      cachedIds = ids;
      authed = true;
      return ids;
    } catch {
      cachedIds = new Set();
      authed = false;
      return cachedIds;
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

export function clearFavoriteCache() {
  cachedIds = null;
  loadingPromise = null;
  authed = false;
}

export function isFavoriteCached(id: number): boolean {
  return cachedIds?.has(id) ?? false;
}

/** Valid only after loadFavoriteIds() settled: false = not logged in (or session expired). */
export function isFavoriteAuthed(): boolean {
  return authed;
}

function announce(id: number, loved: boolean) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<FavoriteChange>(FAVORITE_EVENT, { detail: { id, loved } }));
  }
}

export async function toggleFavoriteServer(id: number): Promise<boolean> {
  if (!authed) {
    // not logged in; redirect caller handles
    throw new Error("AUTH_REQUIRED");
  }
  if (cachedIds?.has(id)) {
    await removeFavorite(id);
    cachedIds?.delete(id);
    announce(id, false);
    return false;
  }
  await addFavorite(id);
  cachedIds?.add(id);
  announce(id, true);
  return true;
}
