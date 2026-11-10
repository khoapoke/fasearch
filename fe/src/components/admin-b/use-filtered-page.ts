"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PageLike<T> = { content: T[]; totalPages: number; totalElements: number };

/**
 * Live-filtered, paged list for the receipt/stocktake screens: filters apply on change after a short pause,
 * only the newest response may update state, and the previous rows stay visible while a new page loads.
 */
export function useFilteredPage<T>(fetcher: (query: string) => Promise<PageLike<T>>, filters: Record<string, string>, errorText: string, size = 10) {
  const [data, setData] = useState<PageLike<T> | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const id = useRef(0);
  const fetchRef = useRef(fetcher);
  useEffect(() => { fetchRef.current = fetcher; });
  const key = JSON.stringify(filters);
  const lastKey = useRef(key);
  // A filter edit stays pending until its request is sent, so a pager click in the meantime cannot keep the old page.
  const pendingFilter = useRef(false);

  useEffect(() => {
    if (lastKey.current !== key) { lastKey.current = key; pendingFilter.current = true; }
    const reset = pendingFilter.current;
    const run = () => {
      pendingFilter.current = false;
      const mine = ++id.current;
      const target = reset ? 0 : page;
      const q = new URLSearchParams({ page: String(target), size: String(size) });
      for (const [k, v] of Object.entries(JSON.parse(key) as Record<string, string>)) if (v.trim()) q.set(k, v.trim());
      setLoading(true); setError("");
      fetchRef.current(q.toString())
        .then((r) => {
          if (mine !== id.current) return;
          // The last row of the last page left the filter: step back instead of showing an empty page.
          if (target > 0 && r.content.length === 0) { setPage(r.totalPages > 0 ? Math.min(target - 1, r.totalPages - 1) : 0); return; }
          setData(r);
        })
        .catch((e) => { if (mine === id.current) setError(e instanceof Error ? e.message : errorText); })
        .finally(() => { if (mine === id.current) setLoading(false); });
    };
    if (reset && page !== 0) { setPage(0); return; }
    const t = window.setTimeout(run, reset ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [key, page, nonce, size, errorText]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, page, setPage, loading, error, reload };
}
