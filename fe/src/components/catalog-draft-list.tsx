"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./catalog-draft-list.module.css";

const PAGE_SIZE = 20;

type DraftSummary = {
  product_id: string;
  product_version_id: string;
  version_no: number;
  status: string;
  title: string;
  category: string;
  created_at: string;
  has_primary_image: boolean;
};

type DraftList = {
  items: DraftSummary[];
  limit: number;
  offset: number;
  has_more: boolean;
  total: number;
};

type Filters = {
  q: string;
  category: string;
  hasImage: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  TOP: "Áo",
  BOTTOM: "Quần / váy rời",
  ONE_PIECE: "Trang phục liền",
};

function readFilters(params: URLSearchParams): Filters {
  return {
    q: params.get("q") ?? "",
    category: params.get("category") ?? "",
    hasImage: params.get("has_primary_image") ?? "",
  };
}

export function CatalogDraftList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => readFilters(searchParams));
  const [searchInput, setSearchInput] = useState(filters.q);
  const [page, setPage] = useState(() => {
    const offset = Number(searchParams.get("offset") ?? "0");
    return Number.isFinite(offset) && offset >= 0
      ? Math.floor(offset / PAGE_SIZE)
      : 0;
  });
  const [data, setData] = useState<DraftList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const buildQuery = useCallback((next: Filters, pageIndex: number) => {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(pageIndex * PAGE_SIZE));
    const q = next.q.trim();
    if (q) params.set("q", q);
    if (next.category) params.set("category", next.category);
    if (next.hasImage) params.set("has_primary_image", next.hasImage);
    return params.toString();
  }, []);

  const fetchList = useCallback(
    async (next: Filters, pageIndex: number, signal: AbortSignal): Promise<DraftList> => {
      const response = await fetch(`/api/catalog/drafts?${buildQuery(next, pageIndex)}`, {
        cache: "no-store",
        signal,
      });
      if (response.status === 401) {
        throw new Error("Hãy đăng nhập để xem sản phẩm nháp.");
      }
      if (response.status === 403) {
        throw new Error("Tài khoản này không có quyền xem sản phẩm nháp.");
      }
      if (!response.ok) {
        throw new Error("Không thể tải danh sách nháp. Hãy thử lại.");
      }
      return (await response.json()) as DraftList;
    },
    [buildQuery],
  );

  const goTo = useCallback(
    async (next: Filters, pageIndex: number) => {
      const id = ++requestId.current;
      const controller = new AbortController();
      setLoading(true);
      setError("");
      try {
        const value = await fetchList(next, pageIndex, controller.signal);
        if (requestId.current !== id) return;
        setData(value);
        setPage(pageIndex);
        setFilters(next);
        router.replace(`${pathname}?${buildQuery(next, pageIndex)}`, { scroll: false });
      } catch (failure) {
        if (failure instanceof DOMException && failure.name === "AbortError") return;
        if (requestId.current !== id) return;
        setError(failure instanceof Error ? failure.message : "Không thể tải danh sách nháp.");
      } finally {
        if (requestId.current === id) setLoading(false);
      }
      return () => controller.abort();
    },
    [fetchList, buildQuery, pathname, router],
  );

  useEffect(() => {
    const initial = readFilters(searchParams);
    const offset = Number(searchParams.get("offset") ?? "0");
    const initialPage =
      Number.isFinite(offset) && offset >= 0 ? Math.floor(offset / PAGE_SIZE) : 0;
    const controller = new AbortController();
    const id = ++requestId.current;
    fetchList(initial, initialPage, controller.signal)
      .then((value) => {
        if (requestId.current !== id) return;
        setData(value);
        setPage(initialPage);
        setFilters(initial);
      })
      .catch((failure: unknown) => {
        if (failure instanceof DOMException && failure.name === "AbortError") return;
        if (requestId.current !== id) return;
        setError(failure instanceof Error ? failure.message : "Không thể tải danh sách nháp.");
      })
      .finally(() => {
        if (requestId.current === id) setLoading(false);
      });
    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Filters = { ...filters, q: searchInput.trim() };
    void goTo(next, 0);
  }

  function applyCategory(value: string) {
    void goTo({ ...filters, category: value }, 0);
  }

  function applyImage(value: string) {
    void goTo({ ...filters, hasImage: value }, 0);
  }

  function clearFilters() {
    setSearchInput("");
    void goTo({ q: "", category: "", hasImage: "" }, 0);
  }

  const hasActiveFilters = filters.q !== "" || filters.category !== "" || filters.hasImage !== "";

  if (loading && !data) {
    return (
      <main className={styles.wrap}>
        <p className={styles.crumbs}>
          <Link href="/catalog/operations">Quản lý catalog</Link> / Sản phẩm nháp
        </p>
        <h1 className={styles.title}>Sản phẩm nháp</h1>
        <p className={styles.status} role="status">Đang tải danh sách nháp…</p>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className={styles.wrap}>
        <p className={styles.crumbs}>
          <Link href="/catalog/operations">Quản lý catalog</Link> / Sản phẩm nháp
        </p>
        <h1 className={styles.title}>Sản phẩm nháp</h1>
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => goTo(filters, 0)}>
            Thử lại
          </button>
        </div>
      </main>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <main className={styles.wrap}>
      <p className={styles.crumbs}>
        <Link href="/catalog/operations">Quản lý catalog</Link> / Sản phẩm nháp
      </p>
      <h1 className={styles.title}>Sản phẩm nháp</h1>
      <p>
        <Link href="/catalog/drafts/new">Tạo sản phẩm nháp</Link>
      </p>

      <form className={styles.toolbar} onSubmit={applySearch} role="search">
        <label className={styles.search}>
          Tìm theo tên
          <input
            type="search"
            value={searchInput}
            maxLength={250}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Ví dụ: áo sơ mi"
          />
        </label>
        <label>
          Danh mục
          <select value={filters.category} onChange={(event) => applyCategory(event.target.value)}>
            <option value="">Tất cả danh mục</option>
            <option value="TOP">Áo</option>
            <option value="BOTTOM">Quần / váy rời</option>
            <option value="ONE_PIECE">Trang phục liền</option>
          </select>
        </label>
        <label>
          Ảnh chính
          <select value={filters.hasImage} onChange={(event) => applyImage(event.target.value)}>
            <option value="">Tất cả</option>
            <option value="true">Đã có ảnh chính</option>
            <option value="false">Chưa có ảnh</option>
          </select>
        </label>
        <div className={styles.toolbarActions}>
          <button type="submit" disabled={loading}>
            Tìm
          </button>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} disabled={loading}>
              Xóa lọc
            </button>
          )}
        </div>
      </form>

      <p className={styles.status} role="status" aria-live="polite">
        {loading
          ? "Đang tải trang…"
          : total === 0
            ? "Không có sản phẩm nháp nào khớp."
            : `Hiển thị ${data!.offset + 1}–${data!.offset + items.length} trong ${total} sản phẩm`}
      </p>
      {error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
        </div>
      )}

      {items.length === 0 ? (
        <div className={styles.empty}>
          {hasActiveFilters ? (
            <>
              <p>Không có sản phẩm nháp nào khớp với bộ lọc hiện tại.</p>
              <p>
                <button type="button" onClick={clearFilters} className={styles.back}>
                  Xóa bộ lọc
                </button>
              </p>
            </>
          ) : page > 0 ? (
            <>
              <p>Trang này không có sản phẩm nháp.</p>
              <p>
                <button
                  className={styles.back}
                  type="button"
                  onClick={() => goTo(filters, 0)}
                >
                  Về trang đầu
                </button>
              </p>
            </>
          ) : (
            <>
              <p>Chưa có sản phẩm nháp nào.</p>
              <p>
                <Link href="/catalog/drafts/new">Tạo sản phẩm đầu tiên</Link>
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.product_id} className={styles.row}>
                <Link
                  href={`/catalog/drafts/${encodeURIComponent(item.product_id)}?from=${encodeURIComponent(`${pathname}?${buildQuery(filters, page)}`)}`}
                >
                  {item.title}
                </Link>
                <div className={styles.meta}>
                  <span>{CATEGORY_LABELS[item.category] ?? item.category}</span>
                  <span>Bản {item.version_no}</span>
                  <span>{item.has_primary_image ? "Đã có ảnh chính" : "Chưa có ảnh"}</span>
                  <time dateTime={item.created_at}>
                    {new Date(item.created_at).toLocaleString("vi-VN")}
                  </time>
                </div>
              </li>
            ))}
          </ul>
          <nav className={styles.pager} aria-label="Phân trang danh sách nháp">
            <button
              type="button"
              disabled={page === 0 || loading}
              onClick={() => goTo(filters, page - 1)}
            >
              Trang trước
            </button>
            <button
              type="button"
              disabled={!data!.has_more || loading}
              onClick={() => goTo(filters, page + 1)}
            >
              Trang sau
            </button>
          </nav>
        </>
      )}
    </main>
  );
}
