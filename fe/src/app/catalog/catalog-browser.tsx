"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type {
  CatalogError,
  CatalogItem,
  CatalogPageResponse,
} from "@/lib/catalog-contract";
import { detailHref, parseCatalogView } from "@/lib/catalog-contract";
import type { FashionCategory } from "@/lib/search-contract";
import { SaveButton } from "@/components/library/save-button";
import styles from "./catalog-browser.module.css";

const CATEGORIES: Array<{ value: FashionCategory | null; label: string }> = [
  { value: null, label: "Tất cả" },
  { value: "TOP", label: "Áo" },
  { value: "BOTTOM", label: "Quần / váy rời" },
  { value: "ONE_PIECE", label: "Trang phục liền" },
];

type BrowseState =
  | { status: "loading" }
  | { status: "success"; data: CatalogPageResponse }
  | { status: "error"; message: string; traceId?: string };

function CatalogCard({ item, snapshot }: { item: CatalogItem; snapshot: string }) {
  return (
    <div className={styles.cardCell}>
      <Link
        className={styles.card}
        href={detailHref(item.product_id, item.product_version_id, snapshot)}
        aria-label={`Xem chi tiết ${item.title}`}
      >
        <span className={styles.imageWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.image}
            src={item.image_url}
            alt={item.title}
            loading="lazy"
          />
        </span>
        <span className={styles.info}>
          <span className={styles.category}>
            {item.category === "TOP"
              ? "Áo"
              : item.category === "BOTTOM"
                ? "Quần / váy rời"
                : "Trang phục liền"}
          </span>
          <span className={styles.title}>{item.title}</span>
          <span className={styles.meta}>{item.product_id}</span>
        </span>
      </Link>
      <SaveButton productId={item.product_id} title={item.title} />
    </div>
  );
}

function BrowserInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { category, page, size } = parseCatalogView(searchParams);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  // Last settled response, keyed by the view that requested it. The visible
  // state is derived: anything not matching the current key is still loading.
  // This keeps setState inside async callbacks only (no set-state-in-effect).
  const viewKey = `${category ?? "ALL"}:p${page}:s${size}:r${retryNonce}`;
  const [settled, setSettled] = useState<{ key: string; state: BrowseState } | null>(null);

  const navigate = useCallback(
    (nextCategory: FashionCategory | null, nextPage: number) => {
      const params = new URLSearchParams();
      if (nextCategory) params.set("category", nextCategory);
      if (nextPage > 1) params.set("page", String(nextPage));
      if (size !== 24) params.set("size", String(size));
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, size],
  );

  useEffect(() => {
    const key = viewKey;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(size));
    if (category) params.set("category", category);

    fetch(`/api/catalog/products?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (requestIdRef.current !== requestId) return;
        const payload = (await response.json()) as CatalogPageResponse | CatalogError;
        if (requestIdRef.current !== requestId) return;
        if (!response.ok) {
          const error = payload as CatalogError;
          setSettled({
            key,
            state: {
              status: "error",
              message: error.message || "Không tải được catalog. Hãy thử lại.",
              traceId: error.trace_id ?? undefined,
            },
          });
          return;
        }
        setSettled({ key, state: { status: "success", data: payload as CatalogPageResponse } });
      })
      .catch((failure: unknown) => {
        if (requestIdRef.current !== requestId) return;
        if (failure instanceof DOMException && failure.name === "AbortError") return;
        setSettled({
          key,
          state: {
            status: "error",
            message: "Kết nối bị gián đoạn. Kiểm tra lại và thử một lần nữa.",
          },
        });
      });

    return () => {
      // Each effect run owns its controller; abort only when superseded by a
      // newer request or unmount, never the current one mid-flight.
      if (requestIdRef.current === requestId) controller.abort();
    };
  }, [category, page, size, retryNonce, viewKey]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const state: BrowseState =
    settled && settled.key === viewKey ? settled.state : { status: "loading" };
  const data = state.status === "success" ? state.data : null;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const snapshot = data?.publication.catalog_snapshot_id ?? "";

  return (
    <div className={styles.browser}>
      <div
        className={styles.chips}
        role="group"
        aria-label="Lọc theo danh mục"
      >
        {CATEGORIES.map((chip) => {
          const active = chip.value === category;
          return (
            <button
              key={chip.label}
              type="button"
              className={active ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              aria-pressed={active}
              onClick={() => navigate(chip.value, 1)}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className={styles.liveRegion} aria-live="polite">
        {state.status === "loading" && <p>Đang tải sản phẩm…</p>}
        {data && (
          <p>
            {data.total === 0
              ? "Chưa có sản phẩm trong phạm vi này."
              : `Hiển thị trang ${data.page}/${totalPages} · tổng ${data.total} sản phẩm.`}
          </p>
        )}
      </div>

      {state.status === "loading" && (
        <ol className={styles.grid} aria-label="Đang tải">
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index} className={styles.skeleton} aria-hidden="true" />
          ))}
        </ol>
      )}

      {state.status === "error" && (
        <div className={styles.errorBox} role="alert">
          <strong>Không tải được catalog</strong>
          <span>{state.message}</span>
          {state.traceId && <small>Mã tra cứu: {state.traceId}</small>}
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => setRetryNonce((value) => value + 1)}
          >
            Thử lại
          </button>
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className={styles.emptyBox}>
          <strong>Không có sản phẩm ở trang này</strong>
          <span>
            Trang {data.page} vượt quá tổng {data.total} sản phẩm. Quay lại trang
            đầu để tiếp tục duyệt.
          </span>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => navigate(category, 1)}
          >
            Về trang đầu
          </button>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <ol className={styles.grid}>
            {data.items.map((item) => (
              <li key={`${item.product_id}:${item.product_version_id}`}>
                <CatalogCard item={item} snapshot={snapshot} />
              </li>
            ))}
          </ol>
          <nav className={styles.pager} aria-label="Phân trang catalog">
            <button
              type="button"
              className={styles.pageButton}
              disabled={data.page <= 1}
              onClick={() => navigate(category, data.page - 1)}
            >
              ← Trang trước
            </button>
            <span className={styles.pageInfo} aria-current="page">
              Trang {data.page}/{totalPages}
            </span>
            <button
              type="button"
              className={styles.pageButton}
              disabled={!data.has_more}
              onClick={() => navigate(category, data.page + 1)}
            >
              Trang sau →
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

export function CatalogBrowser() {
  return (
    <Suspense fallback={<p>Đang tải catalog…</p>}>
      <BrowserInner />
    </Suspense>
  );
}
