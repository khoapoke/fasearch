"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCsrf, readOwnProfile } from "@/components/account/account-session";
import { SaveButton, refreshLibraryStore } from "@/components/library/save-button";
import type { SavedListItem } from "@/lib/library-contract";
import accountStyles from "@/components/account/account.module.css";
import styles from "./saved-list.module.css";

type PageState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "error"; message: string }
  | { status: "ready"; items: SavedListItem[]; total: number };

export function SavedList() {
  const router = useRouter();
  const requestIdRef = useRef(0);
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [retryNonce, setRetryNonce] = useState(0);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");

  useEffect(() => {
    // Promise-chain style like the catalog browser: setState only inside
    // async continuations, never synchronously in the effect body.
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    readOwnProfile()
      .then((profile) => {
        if (requestIdRef.current !== requestId) return;
        if (!profile) {
          setState({ status: "denied" });
          router.replace("/dang-nhap?next=/tai-khoan/san-pham-da-luu");
          return;
        }
        return fetch("/api/me/saved-products?size=100", { cache: "no-store" })
          .then(async (response) => {
            if (requestIdRef.current !== requestId) return;
            if (response.status === 401) {
              setState({ status: "denied" });
              router.replace("/dang-nhap?next=/tai-khoan/san-pham-da-luu");
              return;
            }
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = (await response.json()) as {
              items: SavedListItem[];
              total: number;
            };
            if (requestIdRef.current !== requestId) return;
            setState({ status: "ready", items: payload.items, total: payload.total });
          });
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setState({ status: "error", message: "Không tải được sản phẩm đã lưu. Hãy thử lại." });
      });
  }, [router, retryNonce]);

  async function remove(productId: string) {
    if (removing) return;
    setRemoving(productId);
    try {
      const csrf = await fetchCsrf();
      const response = await fetch(`/api/me/saved-products/${encodeURIComponent(productId)}`, {
        method: "DELETE",
        headers: { [csrf.header]: csrf.token },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await refreshLibraryStore();
      setRemoveError("");
      setState((prev) =>
        prev.status === "ready"
          ? {
              ...prev,
              items: prev.items.filter((item) => item.product_id !== productId),
              total: prev.total - 1,
            }
          : prev,
      );
    } catch {
      setRemoveError("Xóa không hoàn tất. Hãy thử lại.");
    } finally {
      setRemoving(null);
    }
  }

  if (state.status === "loading") {
    return (
      <div aria-live="polite" aria-label="Đang tải sản phẩm đã lưu">
        <div className={styles.skeletonGrid} aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} className={styles.skeleton} />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className={styles.emptyBox}>
        <strong>Cần đăng nhập</strong>
        <span>Trang này chỉ hiển thị sản phẩm do chính bạn lưu.</span>
        <Link className={accountStyles.secondary} href="/dang-nhap?next=/tai-khoan/san-pham-da-luu">
          Đăng nhập
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={styles.errorBox} role="alert">
        <strong>Không tải được danh sách</strong>
        <span>{state.message}</span>
        <button
          type="button"
          className={accountStyles.secondary}
          onClick={() => {
            setState({ status: "loading" });
            setRetryNonce((value) => value + 1);
          }}
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (state.items.length === 0) {
    return (
      <div className={styles.emptyBox}>
        <strong>Chưa lưu sản phẩm nào</strong>
        <span>
          Nhấn “Lưu” trên catalog, chi tiết sản phẩm hoặc bất kỳ kết quả tìm kiếm nào —
          sản phẩm sẽ xuất hiện tại đây.
        </span>
        <Link className={accountStyles.secondary} href="/catalog">
          Duyệt catalog
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className={styles.count} aria-live="polite">
        {state.total === 1 ? "1 sản phẩm đã lưu." : `${state.total} sản phẩm đã lưu.`}
      </p>
      {removeError && (
        <p className={styles.inlineError} role="alert">
          {removeError}
        </p>
      )}
      <ol className={styles.grid}>
        {state.items.map((item) => (
          <li key={item.product_id} className={styles.cell}>
            {item.available && item.product ? (
              // Plain product URL (no frozen version/snapshot): always resolves
              // against the current publication, never a stale saved version.
              <Link
                className={styles.card}
                href={`/catalog/${encodeURIComponent(item.product.product_id)}`}
                aria-label={`Xem chi tiết ${item.product.title}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.product.image_url} alt={item.product.title} loading="lazy" />
                <span className={styles.title}>{item.product.title}</span>
                <span className={styles.meta}>{item.product.product_id}</span>
              </Link>
            ) : (
              <div className={styles.unavailable} aria-label={`Sản phẩm ${item.product_id} không còn khả dụng`}>
                <span className={styles.unavailableMark} aria-hidden="true">
                  ×
                </span>
                <strong>{item.product_id}</strong>
                <span>Sản phẩm không còn trong publication đang công bố.</span>
              </div>
            )}
            <div className={styles.cellActions}>
              <SaveButton
                productId={item.product_id}
                title={item.available && item.product ? item.product.title : item.product_id}
              />
              <button
                type="button"
                className={styles.removeButton}
                disabled={removing === item.product_id}
                onClick={() => void remove(item.product_id)}
                aria-label={`Xóa ${item.product_id} khỏi sản phẩm đã lưu`}
              >
                {removing === item.product_id ? "Đang xóa…" : "Xóa"}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
