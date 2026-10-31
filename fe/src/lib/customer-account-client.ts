// Browser client for STT6 P1 account endpoints (change password, search history, favorites).
// Access token never appears in browser; HttpOnly cookie is server-set.

export type SearchHistoryEntry = {
  id: number;
  mode: "TEXT" | "IMAGE" | "MULTIMODAL";
  query: string | null;
  resultCount: number;
  resultRefs: string | null;
  status: "SUCCESS" | "FAILED" | "CANCELLED";
  occurredAt: string;
};

export type FavoriteEntry = {
  id: number;
  productId: number;
  productName: string | null;
  price: number | null;
  createdAt: string;
};

export type Paged<T> = { data: T[]; page: number; size: number; totalElements: number; totalPages: number };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init });
  const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string; result?: T } | null;
  if (!response.ok || payload?.success !== true) {
    throw Object.assign(new Error(payload?.message || `Yêu cầu thất bại (HTTP ${response.status}).`), { status: response.status });
  }
  return payload.result as T;
}

export async function authChangePassword(oldPassword: string, newPassword: string, signal?: AbortSignal): Promise<void> {
  await call<unknown>("/api/customer-auth/change-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ oldPassword, newPassword }),
    signal,
  });
}

export async function fetchSearchHistory(page = 0, size = 20, signal?: AbortSignal): Promise<Paged<SearchHistoryEntry>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  const result = await call<any>(`/api/customer-account/search-history?${params}`, { signal });
  const content = Array.isArray(result?.content) ? result.content : Array.isArray(result) ? result : [];
  return {
    data: content as SearchHistoryEntry[],
    page: result?.pageNumber ?? page,
    size: result?.pageSize ?? size,
    totalElements: result?.totalElements ?? content.length,
    totalPages: result?.totalPages ?? 1,
  };
}

export async function recordSearchHistory(input: {
  mode: "TEXT" | "IMAGE" | "MULTIMODAL";
  query?: string;
  resultCount?: number;
  resultRefs?: string;
  status: "SUCCESS" | "FAILED" | "CANCELLED";
}, signal?: AbortSignal): Promise<SearchHistoryEntry> {
  return call<SearchHistoryEntry>("/api/customer-account/search-history", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
}

export async function deleteSearchHistory(id: number, signal?: AbortSignal): Promise<void> {
  await call<unknown>(`/api/customer-account/search-history?id=${id}`, { method: "DELETE", signal });
}

export async function fetchFavorites(page = 0, size = 20, signal?: AbortSignal): Promise<Paged<FavoriteEntry>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  const result = await call<any>(`/api/customer-account/favorites?${params}`, { signal });
  const content = Array.isArray(result?.content) ? result.content : Array.isArray(result) ? result : [];
  return {
    data: content as FavoriteEntry[],
    page: result?.pageNumber ?? page,
    size: result?.pageSize ?? size,
    totalElements: result?.totalElements ?? content.length,
    totalPages: result?.totalPages ?? 1,
  };
}

export async function addFavorite(productId: number, signal?: AbortSignal): Promise<FavoriteEntry> {
  return call<FavoriteEntry>(`/api/customer-account/favorites?productId=${productId}`, { method: "POST", signal });
}

export async function removeFavorite(productId: number, signal?: AbortSignal): Promise<void> {
  await call<unknown>(`/api/customer-account/favorites?productId=${productId}`, { method: "DELETE", signal });
}
