/**
 * Pure decisions and state transitions for admin list live search.
 * Kept free of React/DOM so node:test can cover debounce, URL and stale-response rules.
 */

/** 300ms: one request per typed word without feeling laggy. */
export const LIVE_SEARCH_DEBOUNCE_MS = 300;
/** 1-character queries are not fired automatically; Enter still searches. */
export const LIVE_SEARCH_MIN_LENGTH = 2;
/** Mirrors the backend query cap. */
export const LIVE_SEARCH_MAX_LENGTH = 100;

export type LiveSearchPage<T> = {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

export type DebounceDecision =
  | { kind: "skip" }
  | { kind: "tooShort" }
  | { kind: "commit"; term: string };

/** Trim, collapse repeated whitespace, and cap the server-bound query. */
export function normalizeTerm(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, LIVE_SEARCH_MAX_LENGTH);
}

/**
 * Decide what a debounced keystroke should do. IME composition never commits,
 * the committed term is never re-sent, and one character waits for Enter.
 */
export function debounceDecision(
  typed: string,
  committed: string,
  composing: boolean,
  minLength: number = LIVE_SEARCH_MIN_LENGTH,
): DebounceDecision {
  if (composing) return { kind: "skip" };
  const term = normalizeTerm(typed);
  if (term === committed) return { kind: "skip" };
  if (term.length > 0 && term.length < minLength) return { kind: "tooShort" };
  return { kind: "commit", term };
}

export type LiveSearchState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  version: number;
};

/** Start a request: the previous rows stay visible while the new page loads. */
export function beginRequest<T>(state: LiveSearchState<T>, version: number): LiveSearchState<T> {
  return { data: state.data, loading: true, error: null, version };
}

/** Accept a response only from the newest request, so a slow older reply cannot overwrite it. */
export function acceptResponse<T>(state: LiveSearchState<T>, version: number, data: T): LiveSearchState<T> {
  if (state.version !== version) return state;
  return { data, loading: false, error: null, version };
}

/** Ignore failures from superseded requests for the same reason. */
export function failResponse<T>(state: LiveSearchState<T>, version: number, error: string): LiveSearchState<T> {
  if (state.version !== version) return state;
  return { ...state, loading: false, error };
}

/** Build a same-origin URL, omitting null/undefined/blank values (callers pass null for page 0). */
export function searchUrl(pathname: string, values: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
