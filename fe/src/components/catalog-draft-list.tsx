"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
};

export function CatalogDraftList() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<DraftList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchList = useCallback(async (pageIndex: number): Promise<DraftList> => {
    const response = await fetch(
      `/api/catalog/drafts?limit=${PAGE_SIZE}&offset=${pageIndex * PAGE_SIZE}`,
      { cache: "no-store" },
    );
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
  }, []);

  const goTo = useCallback(async (pageIndex: number) => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchList(pageIndex));
      setPage(pageIndex);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tải danh sách nháp.");
    } finally {
      setLoading(false);
    }
  }, [fetchList]);

  useEffect(() => {
    let active = true;
    fetchList(0)
      .then((value) => {
        if (!active) return;
        setData(value);
        setPage(0);
      })
      .catch((failure: unknown) => {
        if (!active) return;
        setError(failure instanceof Error ? failure.message : "Không thể tải danh sách nháp.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchList]);

  if (loading && !data) {
    return (
      <main className={styles.wrap}>
        <h1 className={styles.title}>Sản phẩm nháp</h1>
        <p className={styles.status} role="status">Đang tải danh sách nháp…</p>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className={styles.wrap}>
        <h1 className={styles.title}>Sản phẩm nháp</h1>
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => goTo(0)}>
            Thử lại
          </button>
        </div>
      </main>
    );
  }

  if (!data || data.items.length === 0) {
    const pastFirstPage = (data?.offset ?? 0) > 0;
    return (
      <main className={styles.wrap}>
        <h1 className={styles.title}>Sản phẩm nháp</h1>
        {pastFirstPage ? (
          <>
            <p className={styles.empty}>Trang này không có sản phẩm nháp.</p>
            <p>
              <button
                className={styles.back}
                type="button"
                onClick={() => goTo(0)}
              >
                Về trang đầu
              </button>
            </p>
          </>
        ) : (
          <>
            <p className={styles.empty}>Chưa có sản phẩm nháp nào.</p>
            <p>
              <Link href="/catalog/drafts/new">Tạo sản phẩm đầu tiên</Link>
            </p>
          </>
        )}
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <h1 className={styles.title}>Sản phẩm nháp</h1>
      <p className={styles.status} role="status" aria-live="polite">
        {loading
          ? "Đang tải trang…"
          : `Hiển thị ${data.offset + 1}–${data.offset + data.items.length}`}
      </p>
      {error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
        </div>
      )}
      <ul className={styles.list}>
        {data.items.map((item) => (
          <li key={item.product_id} className={styles.row}>
            <Link href={`/catalog/drafts/${encodeURIComponent(item.product_id)}`}>
              {item.title}
            </Link>
            <div className={styles.meta}>
              <span>{item.category}</span>
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
          onClick={() => goTo(page - 1)}
        >
          Trang trước
        </button>
        <button
          type="button"
          disabled={!data.has_more || loading}
          onClick={() => goTo(page + 1)}
        >
          Trang sau
        </button>
      </nav>
    </main>
  );
}
