"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type {
  FashionCategory,
  TextSearchError,
  TextSearchResponse,
} from "@/lib/search-contract";
import { detailHref } from "@/lib/catalog-contract";
import { SaveButton } from "@/components/library/save-button";
import { createRequestGuard } from "../stitch-search/request-guard";
import {
  MAX_TEXT_CODE_POINTS,
  codePointCount,
  validateTextInput,
} from "./validation";
import {
  SubmittedSnapshot,
  editDraft,
  initialView,
  resetView,
  settleFailure,
  settleSuccess,
  validationFailure,
} from "./search-state";
import styles from "./text-search-workbench.module.css";

const categoryNames: Record<FashionCategory, string> = {
  TOP: "Áo",
  BOTTOM: "Quần / váy rời",
  ONE_PIECE: "Trang phục liền",
};

async function csrfToken(): Promise<{ header: string; token: string }> {
  const response = await fetch("/api/auth/csrf", { cache: "no-store" });
  if (!response.ok) throw new Error("Không thể bắt đầu phiên tìm kiếm.");
  const payload = (await response.json()) as { header_name: string; token: string };
  return { header: payload.header_name, token: payload.token };
}

export function TextSearchWorkbench() {
  const searchParams = useSearchParams();
  const prefill = searchParams.get("q") ?? "";
  const guardRef = useRef<ReturnType<typeof createRequestGuard> | null>(null);
  if (guardRef.current === null) guardRef.current = createRequestGuard();
  const abortRef = useRef<AbortController | null>(null);
  // Draft inputs stay editable without discarding the last settled success.
  // A history "Tìm lại" link carries ?q=: adopted once as an editable draft
  // in the lazy initializer (never auto-searched, user submits explicitly).
  const [view, setView] = useState(() => {
    const initial = initialView(10);
    const seeded = prefill ? prefill.slice(0, 1024) : "";
    return seeded ? editDraft(initial, { draftText: seeded }) : initial;
  });
  const [historyStatus, setHistoryStatus] = useState("");
  const viewRef = useRef(view);
  // Commit-phase sync: render must never write the ref (react-hooks/refs).
  // Event handlers run after commit effects flush, so they still observe
  // the latest view for the pending guard and submit snapshot.
  useEffect(() => {
    viewRef.current = view;
  });

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function editText(next: string) {
    // Editing during a pending request invalidates it and exits the
    // skeleton back to the prior settled state (S4).
    guardRef.current?.invalidate();
    abortRef.current?.abort();
    setView((prev) => editDraft(prev, { draftText: next }));
  }

  function editK(next: number) {
    guardRef.current?.invalidate();
    abortRef.current?.abort();
    setView((prev) => editDraft(prev, { draftK: next }));
  }

  function reset() {
    guardRef.current?.invalidate();
    abortRef.current?.abort();
    setView(resetView(10));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = viewRef.current;
    if (current.pending) return;
    const violation = validateTextInput({ text: current.draftText, k: current.draftK });
    if (violation) {
      setView((prev) => validationFailure(prev, violation));
      return;
    }

    // Snapshot draft at submit time; later typing cannot mutate it (S4).
    const snapshot: SubmittedSnapshot = { text: current.draftText, k: current.draftK };
    const ticket = guardRef.current?.begin() ?? { id: 0 };
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setView((prev) => ({ ...prev, pending: snapshot, failure: null }));

    try {
      const csrf = await csrfToken();
      if (!guardRef.current?.isCurrent(ticket)) return;
      const response = await fetch("/api/search/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [csrf.header]: csrf.token,
        },
        body: JSON.stringify({ schema_version: "1.0.0", query_text: snapshot.text, k: snapshot.k }),
        signal: controller.signal,
      });
      if (!guardRef.current?.isCurrent(ticket)) return;
      const payload = (await response.json()) as
        | TextSearchResponse
        | TextSearchError;
      if (!guardRef.current?.isCurrent(ticket)) return;
      if (!response.ok) {
        const error = payload as TextSearchError;
        setHistoryStatus("");
        setView((prev) =>
          settleFailure(prev, snapshot, {
            message: error.message || "Tìm kiếm không hoàn tất. Hãy thử lại.",
            traceId: error.trace_id ?? undefined,
          }) ?? prev,
        );
        return;
      }
      setHistoryStatus(response.headers.get("x-history-status") ?? "");
      setView((prev) => settleSuccess(prev, snapshot, payload as TextSearchResponse) ?? prev);
    } catch (failure) {
      if (!guardRef.current?.isCurrent(ticket)) return;
      if (failure instanceof DOMException && failure.name === "AbortError") return;
      setView((prev) =>
        settleFailure(prev, snapshot, {
          message: "Kết nối bị gián đoạn. Kiểm tra lại và thử một lần nữa.",
        }) ?? prev,
      );
    }
  }

  const pending = view.pending;
  const settled = view.settled;
  const failure = view.failure;
  const results = settled && !pending ? settled.data.results : [];
  const data = settled && !pending ? settled.data : null;
  const skeletonCount = pending ? Math.min(Math.max(pending.k, 1), 8) : 0;
  const isSearching = pending !== null;
  const statusText = isSearching
    ? `Đang tìm “${pending.text}” (K=${pending.k})…`
    : settled
      ? `Tìm thấy ${settled.data.results.length} sản phẩm cho “${settled.submitted.text}”, giữ nguyên thứ tự xếp hạng của API.`
      : "Nhập mô tả chữ và số kết quả mong muốn.";

  return (
    <section className={styles.workbench} aria-label="Tìm kiếm bằng chữ trực tiếp">
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.textLabel}>
          Mô tả sản phẩm bằng chữ
          <textarea
            className={styles.textInput}
            value={view.draftText}
            maxLength={MAX_TEXT_CODE_POINTS + 16}
            rows={3}
            placeholder="Ví dụ: váy đỏ tay dài"
            onChange={(event) => editText(event.target.value)}
            aria-label="Nhập mô tả sản phẩm bằng chữ, tối đa 1024 ký tự"
          />
        </label>
        <p className={styles.counter}>
          {codePointCount(view.draftText)}/{MAX_TEXT_CODE_POINTS} ký tự
        </p>

        <label className={styles.kLabel}>
          Số kết quả (K)
          <input
            className={styles.kInput}
            type="number"
            min={1}
            max={100}
            value={view.draftK}
            onChange={(event) => editK(Number(event.target.value))}
            aria-label="Số kết quả K từ 1 đến 100"
          />
        </label>

        <div className={styles.actions}>
          <button
            className={styles.searchButton}
            type="submit"
            disabled={isSearching}
          >
            {isSearching ? "Đang tìm kiếm…" : "Tìm bằng chữ"}
          </button>
          <button
            className={styles.resetButton}
            type="button"
            onClick={reset}
            disabled={isSearching}
          >
            Đặt lại
          </button>
        </div>

        <div className={styles.liveRegion} aria-live="polite">
          <p>{statusText}</p>
          {failure && (
            <div className={styles.errorBox} role="alert">
              <strong>Không thể tìm kiếm</strong>
              <span>{failure.message}</span>
              {settled ? (
                <span>
                  Giữ kết quả của “{settled.submitted.text}” (K={settled.submitted.k}).
                </span>
              ) : (
                <span>Truy vấn lỗi: “{failure.failed.text}” (K={failure.failed.k}).</span>
              )}
              {failure.traceId && <small>Mã tra cứu: {failure.traceId}</small>}
            </div>
          )}
        </div>
      </form>

      <div className={styles.results} aria-label="Kết quả tìm kiếm bằng chữ" aria-busy={isSearching}>
        <h2>
          {isSearching
            ? "Đang tải kết quả…"
            : settled
              ? `${settled.data.results.length} sản phẩm gần nhất`
              : "Kết quả sẽ xuất hiện tại đây"}
        </h2>
        {isSearching ? (
          <div className={styles.skeletonGrid} aria-hidden="true">
            {Array.from({ length: skeletonCount }, (_, index) => (
              <div key={index} className={styles.skeletonCard}>
                <span className={styles.skeletonPhoto} />
                <span className={styles.skeletonLine} />
                <span className={styles.skeletonLineShort} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {settled && settled.data.results.length === 0 && (
              <p className={styles.emptyState}>
                Catalog chưa có sản phẩm phù hợp với mô tả “{settled.submitted.text}”.
              </p>
            )}
            {results.length > 0 && (
          <ol className={styles.resultList}>
            {results.map((product) => (
              <li key={`${product.product_id}:${product.product_version_id}`}>
                <Link
                  href={`${detailHref(
                    product.product_id,
                    product.product_version_id,
                    data?.publication.catalog_snapshot_id ?? "",
                  )}&return_to=${encodeURIComponent("/search/text")}`}
                  aria-label={`Xem chi tiết ${product.title}`}
                >
                <article className={styles.card}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.image_url} alt={product.title} loading="lazy" />
                  <div>
                    <span className={styles.cardCategory}>
                      Hạng {product.rank} · {categoryNames[product.category]}
                    </span>
                    <h3>{product.title}</h3>
                    <p>
                      Mức tương đồng thô {product.similarity_score.toFixed(4)} ·{" "}
                      {product.product_id}
                    </p>
                  </div>
                </article>
                </Link>
                <SaveButton productId={product.product_id} title={product.title} />
              </li>
            ))}
          </ol>
        )}
        {historyStatus === "RECORDED" && settled && !pending && (
          <p className={styles.historyNote}>Đã lưu lần tìm này vào lịch sử của bạn.</p>
        )}
          </>
        )}
        {data && (
          <details className={styles.diagnostics}>
            <summary>Chi tiết chẩn đoán &amp; truy vết</summary>
            <dl>
              <div>
                <dt>Catalog snapshot</dt>
                <dd>{data.publication.catalog_snapshot_id}</dd>
              </div>
              <div>
                <dt>Model / Index</dt>
                <dd>
                  {data.publication.model_version} / {data.publication.index_version}
                </dd>
              </div>
              <div>
                <dt>Chính sách tràn chữ</dt>
                <dd>{data.provenance.text_overflow_policy}</dd>
              </div>
              <div>
                <dt>Phạm vi artifact</dt>
                <dd>{data.provenance.artifact_scope}</dd>
              </div>
              <div>
                <dt>Model config / chuẩn hoá chữ</dt>
                <dd>
                  {data.provenance.model_config_hash} ·{" "}
                  {data.provenance.text_normalization_version}
                </dd>
              </div>
              <div>
                <dt>Trace</dt>
                <dd>{data.trace_id}</dd>
              </div>
            </dl>
          </details>
        )}
      </div>
    </section>
  );
}
