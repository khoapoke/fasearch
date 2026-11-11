"use client";

import type { ChangeEvent, CompositionEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  acceptResponse,
  beginRequest,
  debounceDecision,
  failResponse,
  LIVE_SEARCH_DEBOUNCE_MS,
  LIVE_SEARCH_MAX_LENGTH,
  LIVE_SEARCH_MIN_LENGTH,
  normalizeTerm,
  type LiveSearchPage,
  type LiveSearchState,
} from "@/lib/live-search";

type Options<T> = {
  /** Search text from the server page props, so the first render matches the URL. */
  initialQuery: string;
  initialPage?: number;
  /** Noun used by the role="status" readout ("sản phẩm", "SKU", "đơn", "khách hàng"). */
  unit: string;
  /** Other filters; a change refetches with the committed query and resets nothing by itself. */
  filtersKey?: string;
  minLength?: number;
  request: (query: string, page: number, signal: AbortSignal) => Promise<T>;
  buildUrl: (query: string, page: number) => string;
};

/**
 * Debounced, abortable list search shared by the four admin lists.
 * The previous page stays visible while a new one loads; only the newest
 * response may update state, so an out-of-order reply can never win.
 */
export function useLiveSearch<T extends LiveSearchPage<unknown>>(options: Options<T>) {
  const {
    initialQuery,
    initialPage = 0,
    unit,
    filtersKey = "",
    minLength = LIVE_SEARCH_MIN_LENGTH,
  } = options;

  const [typed, setTyped] = useState(() => normalizeTerm(initialQuery));
  const [term, setTerm] = useState(() => normalizeTerm(initialQuery));
  const [page, setPage] = useState(() => Math.max(0, Math.trunc(initialPage)));
  const [tooShort, setTooShort] = useState(false);
  const [composeEpoch, setComposeEpoch] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<LiveSearchState<T>>({
    data: null,
    loading: true,
    error: null,
    version: 0,
  });

  const composing = useRef(false);
  const timer = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const versionRef = useRef(0);
  const requestRef = useRef(options.request);
  const buildUrlRef = useRef(options.buildUrl);
  const firstUrlSync = useRef(true);
  const mountTerm = useRef(term);
  const mountPage = useRef(page);
  const previousProps = useRef({ query: normalizeTerm(initialQuery), page: Math.max(0, Math.trunc(initialPage)) });

  // Latest filters/URL builder, read by effects that run after this one.
  useEffect(() => {
    requestRef.current = options.request;
    buildUrlRef.current = options.buildUrl;
  });

  function clearTimer() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  // Debounce typing. Composition (Vietnamese IME/Telex) never schedules a request.
  useEffect(() => {
    const decision = debounceDecision(typed, term, composing.current, minLength);
    if (decision.kind === "skip") {
      if (!composing.current) setTooShort(false);
      return;
    }
    if (decision.kind === "tooShort") {
      setTooShort(true);
      return;
    }
    const id = window.setTimeout(() => {
      if (timer.current === id) timer.current = null;
      if (composing.current) return;
      setTooShort(false);
      setTerm(decision.term);
      setPage(0);
      setNonce((value) => value + 1);
    }, LIVE_SEARCH_DEBOUNCE_MS);
    timer.current = id;
    return () => {
      window.clearTimeout(id);
      if (timer.current === id) timer.current = null;
    };
  }, [typed, term, composeEpoch, minLength]);

  // Fetch the committed query. One effect run = one request; cleanup aborts the old one.
  useEffect(() => {
    const version = ++versionRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((current) => beginRequest(current, version));
    requestRef.current(term, page, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setState((current) => acceptResponse(current, version, data));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Không tải được dữ liệu.";
        setState((current) => failResponse(current, version, message));
      });
    return () => controller.abort();
  }, [term, page, filtersKey, nonce]);

  // The last row of the last page left the filter: step back instead of stranding the user on an empty page.
  useEffect(() => {
    const data = state.data;
    if (state.loading || !data || page === 0 || data.content.length > 0) return;
    const back = data.totalPages > 0 ? Math.min(page - 1, data.totalPages - 1) : 0;
    void Promise.resolve().then(() => setPage(back));
  }, [state.data, state.loading, page]);

  // Mirror query and page in the URL with replace, so typing adds no history entries.
  // The first URL comes from the server page props; leaving it untouched avoids a rewrite on load.
  useEffect(() => {
    if (firstUrlSync.current) {
      firstUrlSync.current = false;
      return;
    }
    window.history.replaceState(null, "", buildUrlRef.current(term, page));
  }, [term, page, filtersKey]);

  // The router can restore a cached payload whose server props are older than the address bar
  // (notably on Back). The URL wins, but only when it actually differs from the mounted props;
  // a legacy ?orderCode= deep link was already mapped by the server page and is left alone.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("keyword") && mountTerm.current !== "") return;
    const nextTerm = normalizeTerm(params.get("keyword") ?? "");
    const rawPage = Number(params.get("page") ?? "0");
    const nextPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.trunc(rawPage) : 0;
    if (nextTerm === mountTerm.current && nextPage === mountPage.current) return;
    setTyped(nextTerm);
    setTerm(nextTerm);
    setPage(nextPage);
    setTooShort(false);
    setNonce((value) => value + 1);
  }, []);

  // A same-route client navigation updates the server props without remounting this hook.
  useEffect(() => {
    const query = normalizeTerm(initialQuery);
    const nextPage = Math.max(0, Math.trunc(initialPage));
    const previous = previousProps.current;
    if (query === previous.query && nextPage === previous.page) return;
    previousProps.current = { query, page: nextPage };
    // Queued together with the filter props so both land in one render (and one fetch).
    void Promise.resolve().then(() => {
      setTyped(query);
      setTerm(query);
      setPage(nextPage);
      setTooShort(false);
      setNonce((value) => value + 1);
    });
  }, [initialQuery, initialPage]);

  // Back/Forward: restore the text and page from the address bar, then refetch.
  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      const nextTerm = normalizeTerm(params.get("keyword") ?? "");
      const rawPage = Number(params.get("page") ?? "0");
      setTyped(nextTerm);
      setTerm(nextTerm);
      setPage(Number.isFinite(rawPage) && rawPage > 0 ? Math.trunc(rawPage) : 0);
      setTooShort(false);
      setNonce((value) => value + 1);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function searchNow() {
    clearTimer();
    const next = normalizeTerm(typed);
    setTyped(next);
    setTerm(next);
    setPage(0);
    setTooShort(false);
    setNonce((value) => value + 1);
  }

  function clear() {
    clearTimer();
    composing.current = false;
    setTyped("");
    setTerm("");
    setPage(0);
    setTooShort(false);
    setNonce((value) => value + 1);
  }

  function reload() {
    setNonce((value) => value + 1);
  }

  function goToPage(next: number) {
    setPage(Math.max(0, Math.trunc(next)));
  }

  const inputProps = {
    value: typed,
    maxLength: LIVE_SEARCH_MAX_LENGTH,
    autoComplete: "off",
    enterKeyHint: "search" as const,
    "aria-busy": state.loading,
    onChange: (event: ChangeEvent<HTMLInputElement>) => setTyped(event.target.value),
    onCompositionStart: () => {
      composing.current = true;
      clearTimer();
    },
    onCompositionEnd: (event: CompositionEvent<HTMLInputElement>) => {
      composing.current = false;
      setTyped(event.currentTarget.value);
      setComposeEpoch((value) => value + 1);
    },
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        searchNow();
      } else if (event.key === "Escape") {
        event.preventDefault();
        clear();
      }
    },
  };

  const statusText = state.error
    ? ""
    : tooShort
      ? `Nhập thêm ${Math.max(1, minLength - normalizeTerm(typed).length)} ký tự để tìm.`
      : state.loading
        ? "Đang tìm…"
        : state.data
          ? `${state.data.totalElements} ${unit}${term ? ` cho “${term}”` : ""}`
          : "";

  return {
    typed,
    term,
    page,
    data: state.data,
    loading: state.loading,
    error: state.error,
    tooShort,
    statusText,
    inputProps,
    searchNow,
    clear,
    reload,
    goToPage,
  };
}
