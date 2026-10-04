"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import type {
  CatalogDetailResponse,
  CatalogError,
  CatalogPageResponse,
} from "@/lib/catalog-contract";
import { composedAnchorHref, detailHref, safeReturnHref } from "@/lib/catalog-contract";
import styles from "./catalog-detail.module.css";

type DetailState =
  | { status: "loading" }
  | { status: "success"; data: CatalogDetailResponse }
  | {
      status: "error";
      message: string;
      traceId?: string;
      code?: string;
      retryable: boolean;
    };

const categoryNames = {
  TOP: "Áo",
  BOTTOM: "Quần / váy rời",
  ONE_PIECE: "Trang phục liền",
} as const;

function DetailInner({ productId }: { productId: string }) {
  const searchParams = useSearchParams();
  const expectedVersion = searchParams.get("v");
  const expectedSnapshot = searchParams.get("s");
  const returnTo = safeReturnHref(searchParams.get("return_to"));  const requestIdRef = useRef(0);
  const [retryNonce, setRetryNonce] = useState(0);
  const viewKey = `${productId}:v${expectedVersion ?? ""}:s${expectedSnapshot ?? ""}:r${retryNonce}`;
  const [settled, setSettled] = useState<{ key: string; state: DetailState } | null>(null);
  const [related, setRelated] = useState<{ key: string; data: CatalogPageResponse } | null>(null);

  useEffect(() => {
    const key = viewKey;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();

    const params = new URLSearchParams();
    if (expectedVersion && expectedSnapshot) {
      params.set("product_version_id", expectedVersion);
      params.set("catalog_snapshot_id", expectedSnapshot);
    }
    const query = params.toString();

    fetch(
      `/api/catalog/products/${encodeURIComponent(productId)}${query ? `?${query}` : ""}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        if (requestIdRef.current !== requestId) return;
        const payload = (await response.json()) as
          | CatalogDetailResponse
          | CatalogError;
        if (requestIdRef.current !== requestId) return;
        if (!response.ok) {
          const error = payload as CatalogError;
          const missing =
            response.status === 404 || response.status === 409;
          setSettled({
            key,
            state: {
              status: "error",
              message:
                response.status === 404
                  ? "Sản phẩm không có trong publication đang công bố (không rõ, đã ẩn hoặc khác phiên bản)."
                  : response.status === 409
                    ? "Snapshot đã thay đổi so với publication đang công bố. Hãy tải lại từ danh sách hoặc kết quả tìm kiếm."
                    : error.message || "Không tải được chi tiết sản phẩm.",
              traceId: error.trace_id ?? undefined,
              code: error.code,
              retryable: !missing,
            },
          });
          return;
        }
        const detail = payload as CatalogDetailResponse;
        setSettled({ key, state: { status: "success", data: detail } });
        // Same-category strip: real list API, no AI score, secondary content.
        fetch(
          `/api/catalog/products?page=1&size=8&category=${detail.category}`,
          { cache: "no-store", signal: controller.signal },
        )
          .then(async (relatedResponse) => {
            if (requestIdRef.current !== requestId) return;
            if (!relatedResponse.ok) return;
            const page = (await relatedResponse.json()) as CatalogPageResponse;
            if (requestIdRef.current !== requestId) return;
            setRelated({ key, data: page });
          })
          .catch(() => {
            // Related strip is optional; the detail itself already succeeded.
          });
      })
      .catch((failure: unknown) => {
        if (requestIdRef.current !== requestId) return;
        if (failure instanceof DOMException && failure.name === "AbortError") return;
        setSettled({
          key,
          state: {
            status: "error",
            message: "Kết nối bị gián đoạn. Kiểm tra lại và thử một lần nữa.",
            retryable: true,
          },
        });
      });

    return () => {
      if (requestIdRef.current === requestId) controller.abort();
    };
  }, [productId, expectedVersion, expectedSnapshot, retryNonce, viewKey]);

  const state: DetailState =
    settled && settled.key === viewKey ? settled.state : { status: "loading" };
  const relatedPage =
    related && related.key === viewKey ? related.data : null;

  if (state.status === "loading") {
    return (
      <div className={styles.detail} aria-live="polite">
        <p>Đang tải chi tiết sản phẩm…</p>
        <div className={styles.loadingGrid} aria-hidden="true">
          <span className={styles.photoSkeleton} />
          <span className={styles.textSkeleton} />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={styles.detail}>
        <div className={styles.errorBox} role="alert">
          <strong>Không xem được sản phẩm</strong>
          <span>{state.message}</span>
          {state.traceId && <small>Mã tra cứu: {state.traceId}</small>}
          <div className={styles.errorActions}>
            {state.retryable && (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setRetryNonce((value) => value + 1)}
              >
                Thử lại
              </button>
            )}
            <Link className={styles.backLink} href={returnTo}>
              ← Quay lại
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const detail = state.data;
  const sameCategory =
    relatedPage?.items.filter((item) => item.product_id !== detail.product_id).slice(0, 7) ?? [];

  return (
    <div className={styles.detail}>
      <Link className={styles.backLink} href={returnTo}>
        ← Quay lại
      </Link>
      <div className={styles.layout}>
        <div className={styles.photoCol}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.photo}
            src={detail.image_url}
            alt={detail.title}
          />
        </div>
        <div className={styles.infoCol}>
          <p className={styles.category}>{categoryNames[detail.category]}</p>
          <h1 className={styles.title}>{detail.title}</h1>
          <p className={styles.description}>
            {detail.description ?? "Chưa có mô tả"}
          </p>
          <Link
            className={styles.primaryButton}
            href={composedAnchorHref(
              detail.product_id,
              detail.product_version_id,
              detail.publication.catalog_snapshot_id,
            )}
          >
            Tìm kết hợp với sản phẩm này
          </Link>
          <details className={styles.provenance}>
            <summary>Thông tin publication</summary>
            <dl>
              <div>
                <dt>Mã sản phẩm</dt>
                <dd>{detail.product_id}</dd>
              </div>
              <div>
                <dt>Phiên bản</dt>
                <dd>{detail.product_version_id}</dd>
              </div>
              <div>
                <dt>Catalog snapshot</dt>
                <dd>{detail.publication.catalog_snapshot_id}</dd>
              </div>
              <div>
                <dt>Model / Index</dt>
                <dd>
                  {detail.publication.model_version} /{" "}
                  {detail.publication.index_version}
                </dd>
              </div>
            </dl>
          </details>
        </div>
      </div>
      {sameCategory.length > 0 && relatedPage && (
        <section className={styles.related} aria-label="Cùng danh mục">
          <h2>Cùng danh mục</h2>
          <ol className={styles.relatedGrid}>
            {sameCategory.map((item) => (
              <li key={`${item.product_id}:${item.product_version_id}`}>
                <Link
                  className={styles.relatedCard}
                  href={detailHref(
                    item.product_id,
                    item.product_version_id,
                    relatedPage.publication.catalog_snapshot_id,
                  )}
                  aria-label={`Xem chi tiết ${item.title}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image_url} alt={item.title} loading="lazy" />
                  <span>{item.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

export function CatalogDetail({ productId }: { productId: string }) {
  return (
    <Suspense fallback={<p>Đang tải chi tiết sản phẩm…</p>}>
      <DetailInner productId={productId} />
    </Suspense>
  );
}
