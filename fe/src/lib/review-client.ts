// Browser client for product reviews (same-origin BFF; JWT stays in the HttpOnly cookie).

export type SizeFit = "NHO" | "VUA" | "RONG";

export const FIT_LABEL: Record<SizeFit, string> = { NHO: "Hơi nhỏ", VUA: "Vừa vặn", RONG: "Hơi rộng" };

export type ReviewItem = {
  id: number;
  productId: number;
  rating: number;
  title: string | null;
  body: string | null;
  sizeFit: SizeFit | null;
  verifiedPurchase: boolean;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  hidden?: boolean;
};

export type ReviewSummary = {
  productId: number;
  average: number;
  count: number;
  distribution: Record<string, number>;
  fit: Record<string, number>;
  fitCount: number;
  fitVerdict: SizeFit | null;
};

export type ReviewPage = { content: ReviewItem[]; pageNumber: number; totalElements: number; totalPages: number; last: boolean };

export type ReviewEligibility = {
  canReview: boolean;
  purchased: boolean;
  alreadyReviewed: boolean;
  reason: "NOT_PURCHASED" | "ALREADY_REVIEWED" | null;
  myReview: ReviewItem | null;
};

export type ReviewInput = { rating: number; title: string; body: string; sizeFit: SizeFit | null };

export class ReviewError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { cache: "no-store", ...init });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ReviewError("Không kết nối được máy chủ. Thử lại.", 0);
  }
  const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string; result?: T } | null;
  if (!response.ok || payload?.success !== true) {
    throw new ReviewError(payload?.message || `Yêu cầu thất bại (HTTP ${response.status}).`, response.status);
  }
  return payload.result as T;
}

const base = (productId: number | string) => `/api/customer-commerce/reviews/${productId}`;

export const REVIEWS_CHANGED_EVENT = "fa:reviews-changed";

export function notifyReviewsChanged(productId: number | string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(REVIEWS_CHANGED_EVENT, { detail: { productId: Number(productId) } }));
}

export function fetchReviewSummary(productId: number | string, signal?: AbortSignal) {
  return call<ReviewSummary>(`${base(productId)}/summary`, { signal });
}

export function fetchReviews(
  productId: number | string,
  opts: { rating?: number | null; sort?: string; page?: number; size?: number },
  signal?: AbortSignal,
) {
  const q = new URLSearchParams();
  if (opts.rating) q.set("rating", String(opts.rating));
  if (opts.sort) q.set("sort", opts.sort);
  q.set("page", String(opts.page ?? 0));
  q.set("size", String(opts.size ?? 5));
  return call<ReviewPage>(`${base(productId)}?${q}`, { signal });
}

/** null = chưa đăng nhập; canReview=false + reason=null = vai trò không phải khách. */
export async function fetchMyReviewState(productId: number | string, signal?: AbortSignal): Promise<ReviewEligibility | null> {
  try {
    return await call<ReviewEligibility>(`${base(productId)}/me`, { signal });
  } catch (error) {
    if (error instanceof ReviewError && error.status === 401) return null;
    if (error instanceof ReviewError && error.status === 403) {
      return { canReview: false, purchased: false, alreadyReviewed: false, reason: null, myReview: null };
    }
    throw error;
  }
}

const jsonHeaders = { "content-type": "application/json" };

export function submitReview(productId: number | string, input: ReviewInput, update: boolean) {
  return call<ReviewItem>(base(productId), { method: update ? "PUT" : "POST", headers: jsonHeaders, body: JSON.stringify(input) });
}

export function deleteReview(productId: number | string) {
  return call<null>(base(productId), { method: "DELETE", headers: jsonHeaders, body: "{}" });
}
