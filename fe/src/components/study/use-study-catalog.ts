"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CatalogError,
  fetchCatalogBrands,
  fetchCatalogCategories,
  fetchCatalogProducts,
  type CatalogBrand,
  type CatalogCategory,
  type CatalogPage,
} from "@/lib/customer-catalog";

export type StudyFilters = {
  brand: string;
  categoryId: string;
  keyword: string;
  minPrice: string;
  maxPrice: string;
  sort: string;
};

export const STUDY_EMPTY: StudyFilters = { brand: "", categoryId: "", keyword: "", minPrice: "", maxPrice: "", sort: "id,desc" };
export const STUDY_PAGE_SIZE = 6;

function filtersFromParams(p: { get: (k: string) => string | null }): StudyFilters {
  const num = (k: string) => {
    const raw = p.get(k);
    return raw !== null && raw !== "" && Number.isFinite(Number(raw)) ? raw : "";
  };
  const sort = p.get("sort");
  return {
    brand: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.get("brand") ?? "") ? (p.get("brand") as string) : "",
    categoryId: /^\d+$/.test(p.get("categoryId") ?? "") ? (p.get("categoryId") as string) : "",
    keyword: (p.get("keyword") ?? "").slice(0, 200),
    minPrice: num("minPrice"),
    maxPrice: num("maxPrice"),
    sort: sort === "price,asc" || sort === "price,desc" || sort === "productName,asc" || sort === "productName,desc" ? sort : "id,desc",
  };
}

function queryString(pathname: string, direction: string, next: StudyFilters, nextPage: number): string {
  const q = new URLSearchParams({ direction });
  if (next.brand) q.set("brand", next.brand);
  if (next.categoryId) q.set("categoryId", next.categoryId);
  if (next.keyword) q.set("keyword", next.keyword);
  if (next.minPrice) q.set("minPrice", next.minPrice);
  if (next.maxPrice) q.set("maxPrice", next.maxPrice);
  if (next.sort !== STUDY_EMPTY.sort) q.set("sort", next.sort);
  if (nextPage > 0) q.set("page", String(nextPage));
  return `${pathname}?${q.toString()}`;
}

export type PriceExtent = { min: number; max: number };

/** Shared study state: same initial filters/page/products for A and B, URL-backed. */
export function useStudyCatalog(direction: "a" | "b") {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [filters, setFilters] = useState<StudyFilters>(() => filtersFromParams(params));
  const [draft, setDraft] = useState({ keyword: params.get("keyword") ?? "" });
  const [page, setPage] = useState(() => Number(params.get("page") ?? "0") || 0);
  const [retry, setRetry] = useState(0);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [extent, setExtent] = useState<PriceExtent | null>(null);
  const reqId = useRef(0);
  const [composeEpoch, setComposeEpoch] = useState(0);
  const queryKey = JSON.stringify({ filters, page, retry });
  const [settled, setSettled] = useState<{ key: string; data?: CatalogPage; error?: string }>({ key: "" });
  const loading = settled.key !== queryKey;
  const data = settled.key === queryKey ? settled.data ?? null : null;
  const error = settled.key === queryKey ? settled.error ?? "" : "";
  // R7: refs tươi cho debounce (không stale closure khi filter khác đổi giữa chừng).
  const filtersRef = useRef(filters);
  // eslint-disable-next-line react-hooks/refs -- intentional latest-ref pattern read by debounced callbacks
  filtersRef.current = filters;
  const draftRef = useRef(draft);
  // eslint-disable-next-line react-hooks/refs -- intentional latest-ref pattern read by debounced callbacks
  draftRef.current = draft;
  const pendingKey = useRef<number | null>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    const c = new AbortController();
    fetchCatalogBrands(c.signal).then((l) => { if (!c.signal.aborted) setBrands(l); }).catch(() => { if (!c.signal.aborted) setBrands([]); });
    fetchCatalogCategories(c.signal).then((l) => { if (!c.signal.aborted) setCategories(l); }).catch(() => { if (!c.signal.aborted) setCategories([]); });
    // Real global extent, read-only: cheapest + priciest ACTIVE product. No stats module.
    Promise.all([
      fetchCatalogProducts({ page: 0, size: 1, sort: "price,asc" }, c.signal),
      fetchCatalogProducts({ page: 0, size: 1, sort: "price,desc" }, c.signal),
    ])
      .then(([lo, hi]) => {
        if (c.signal.aborted || !lo.items.length || !hi.items.length) return;
        setExtent({ min: lo.items[0].price, max: hi.items[0].price });
      })
      .catch(() => { if (!c.signal.aborted) setExtent(null); });
    return () => c.abort();
  }, []);

  useEffect(() => {
    const c = new AbortController();
    const my = ++reqId.current;
    fetchCatalogProducts(
      {
        brand: filters.brand || undefined,
        categoryId: filters.categoryId ? Number(filters.categoryId) : null,
        keyword: filters.keyword,
        minPrice: filters.minPrice ? Number(filters.minPrice) : null,
        maxPrice: filters.maxPrice ? Number(filters.maxPrice) : null,
        page,
        size: STUDY_PAGE_SIZE,
        sort: filters.sort,
      },
      c.signal,
    )
      .then((result) => { if (reqId.current === my) setSettled({ key: queryKey, data: result }); })
      .catch((err) => {
        if (c.signal.aborted || reqId.current !== my) return;
        setSettled({ key: queryKey, error: err instanceof CatalogError ? err.message : "Không kết nối được máy chủ danh mục. Thử lại." });
      });
    return () => c.abort();
  }, [filters, page, retry, queryKey]);

  function commit(next: StudyFilters, nextPage = 0, replace = false) {
    setFilters(next);
    setPage(nextPage);
    const url = queryString(pathname, direction, next, nextPage);
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  }

  /** R7: Enter gõ từ khóa — hủy debounce đang chờ, commit ngay (push, deliberate);
      trùng giá trị thì no-op (không fetch/App history thừa). */
  function commitKeywordNow() {
    if (pendingKey.current !== null) {
      clearTimeout(pendingKey.current);
      pendingKey.current = null;
    }
    const typed = draftRef.current.keyword.trim();
    if (typed !== filtersRef.current.keyword) commit({ ...filtersRef.current, keyword: typed }, 0, false);
  }

  /** R7 + R8-F-R7-IME: compositionend bump epoch nên effect hẹn đúng một lần
      tìm kiếm cho chuỗi cuối, kể cả khi chuỗi cuối trùng chuỗi trước (draft không đổi). */
  function markComposing(active: boolean) {
    composingRef.current = active;
    if (!active) setComposeEpoch((n) => n + 1);
  }

  // R7: debounce 500ms sau nhịp gõ; commit dùng replace (không spam history).
  // Tự hủy khi: unmount, draft đổi tiếp, hoặc Back/link ngoài đồng bộ state.
  useEffect(() => {
    const typed = draft.keyword.trim();
    if (typed === filters.keyword || composingRef.current) return;
    const id = window.setTimeout(() => {
      pendingKey.current = null;
      const cur = filtersRef.current;
      const t = draftRef.current.keyword.trim();
      if (t !== cur.keyword) commit({ ...cur, keyword: t }, 0, true);
    }, 500);
    pendingKey.current = id;
    return () => {
      clearTimeout(id);
      if (pendingKey.current === id) pendingKey.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.keyword, composeEpoch]);

  // Back/Forward: params ngoài ⇒ state theo sau.
  useEffect(() => {
    const from = filtersFromParams(params);
    const fromPage = Number(params.get("page") ?? "0") || 0;
    if (JSON.stringify({ ...from, page: fromPage }) !== JSON.stringify({ ...filters, page })) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: state sync/reset or one-shot mount read inside an effect; refactor would change behaviour
      setFilters(from);
      setDraft({ keyword: from.keyword });
      setPage(fromPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Auto-repair late page bằng replace (không kẹt Back — bài học P2 pagination).
  useEffect(() => {
    if (!loading && data && data.items.length === 0 && page > 0 && data.totalPages > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: state sync/reset or one-shot mount read inside an effect; refactor would change behaviour
      commit(filters, 0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data]);

  // R7: giữ kết quả cũ trong lúc refetch (không chớp lưới, giữ chiều cao);
  // skeleton chỉ khi chưa hề có dữ liệu VÀ pending quá ~200ms.
  const [lastData, setLastData] = useState<CatalogPage | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: state sync/reset or one-shot mount read inside an effect; refactor would change behaviour
  useEffect(() => { if (data) setLastData(data); }, [data]);
  const display = data ?? lastData;
  const refetching = loading && lastData !== null;
  const [slowLoad, setSlowLoad] = useState(false);
  useEffect(() => {
    if (!(loading && !display)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: state sync/reset or one-shot mount read inside an effect; refactor would change behaviour
      setSlowLoad(false);
      return;
    }
    const id = window.setTimeout(() => setSlowLoad(true), 200);
    return () => clearTimeout(id);
  }, [loading, display]);

  // R2-F4: tong 0 san pham => null (doc "0 san pham", khong bao gio "1-0").
  const range = useMemo(() => {
    if (!data || loading || data.totalElements <= 0) return null;
    const from = page * STUDY_PAGE_SIZE + 1;
    if (from > data.totalElements) return null;
    return { from, to: Math.min((page + 1) * STUDY_PAGE_SIZE, data.totalElements) };
  }, [data, loading, page]);

  return { filters, draft, setDraft, page, brands, categories, extent, loading, data, display, refetching, slowLoad, error, range, retry: () => setRetry((n) => n + 1), commit, commitKeywordNow, markComposing };
}

export type StudyApi = ReturnType<typeof useStudyCatalog>;

export function brandLabel(slug: string, name: string): string {
  if (slug === "mlb-korea" && !/korea/i.test(name)) return "MLB Korea";
  if (slug === "mlb" && name.trim().toLowerCase() === "mlb") return "MLB League";
  return name;
}

export function formatShortVnd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}TR`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}
