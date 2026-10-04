"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  FashionCategory,
  TextSearchError,
  TextSearchResponse,
} from "@/lib/search-contract";
import { detailHref } from "@/lib/catalog-contract";
import { createRequestGuard } from "../stitch-search/request-guard";
import {
  MAX_TEXT_CODE_POINTS,
  codePointCount,
  validateTextInput,
} from "./validation";
import styles from "./text-search-workbench.module.css";

const categoryNames: Record<FashionCategory, string> = {
  TOP: "Áo",
  BOTTOM: "Quần / váy rời",
  ONE_PIECE: "Trang phục liền",
};

type SearchState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "success"; data: TextSearchResponse }
  | { status: "error"; message: string; traceId?: string };

async function csrfToken(): Promise<{ header: string; token: string }> {
  const response = await fetch("/api/auth/csrf", { cache: "no-store" });
  if (!response.ok) throw new Error("Không thể bắt đầu phiên tìm kiếm.");
  const payload = (await response.json()) as { header_name: string; token: string };
  return { header: payload.header_name, token: payload.token };
}

export function TextSearchWorkbench() {
  const guardRef = useRef<ReturnType<typeof createRequestGuard> | null>(null);
  if (guardRef.current === null) guardRef.current = createRequestGuard();
  const abortRef = useRef<AbortController | null>(null);
  const [text, setText] = useState("");
  const [k, setK] = useState(10);
  const [state, setState] = useState<SearchState>({ status: "idle" });

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function reset() {
    guardRef.current?.invalidate();
    abortRef.current?.abort();
    setText("");
    setState({ status: "idle" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === "searching") return;
    const violation = validateTextInput({ text, k });
    if (violation) {
      setState({ status: "error", message: violation });
      return;
    }

    const ticket = guardRef.current?.begin() ?? { id: 0 };
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "searching" });

    try {
      const csrf = await csrfToken();
      if (!guardRef.current?.isCurrent(ticket)) return;
      const response = await fetch("/api/search/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [csrf.header]: csrf.token,
        },
        body: JSON.stringify({ schema_version: "1.0.0", query_text: text, k }),
        signal: controller.signal,
      });
      if (!guardRef.current?.isCurrent(ticket)) return;
      const payload = (await response.json()) as
        | TextSearchResponse
        | TextSearchError;
      if (!guardRef.current?.isCurrent(ticket)) return;
      if (!response.ok) {
        const error = payload as TextSearchError;
        setState({
          status: "error",
          message: error.message || "Tìm kiếm không hoàn tất. Hãy thử lại.",
          traceId: error.trace_id ?? undefined,
        });
        return;
      }
      setState({ status: "success", data: payload as TextSearchResponse });
    } catch (failure) {
      if (!guardRef.current?.isCurrent(ticket)) return;
      if (failure instanceof DOMException && failure.name === "AbortError") return;
      setState({
        status: "error",
        message: "Kết nối bị gián đoạn. Kiểm tra lại và thử một lần nữa.",
      });
    }
  }

  const results = state.status === "success" ? state.data.results : [];
  const data = state.status === "success" ? state.data : null;
  const statusText =
    state.status === "searching"
      ? "Đang đối chiếu mô tả chữ với catalog…"
      : state.status === "success"
        ? `Tìm thấy ${results.length} sản phẩm, giữ nguyên thứ tự xếp hạng của API.`
        : "Nhập mô tả chữ và số kết quả mong muốn.";

  return (
    <section className={styles.workbench} aria-label="Tìm kiếm bằng chữ trực tiếp">
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.textLabel}>
          Mô tả sản phẩm bằng chữ
          <textarea
            className={styles.textInput}
            value={text}
            maxLength={MAX_TEXT_CODE_POINTS + 16}
            rows={3}
            placeholder="Ví dụ: váy đỏ tay dài"
            onChange={(event) => {
              guardRef.current?.invalidate();
              abortRef.current?.abort();
              setText(event.target.value);
              setState({ status: "idle" });
            }}
            aria-label="Nhập mô tả sản phẩm bằng chữ, tối đa 1024 ký tự"
          />
        </label>
        <p className={styles.counter}>
          {codePointCount(text)}/{MAX_TEXT_CODE_POINTS} ký tự
        </p>

        <label className={styles.kLabel}>
          Số kết quả (K)
          <input
            className={styles.kInput}
            type="number"
            min={1}
            max={100}
            value={k}
            onChange={(event) => setK(Number(event.target.value))}
            aria-label="Số kết quả K từ 1 đến 100"
          />
        </label>

        <div className={styles.actions}>
          <button
            className={styles.searchButton}
            type="submit"
            disabled={state.status === "searching"}
          >
            {state.status === "searching" ? "Đang tìm kiếm…" : "Tìm bằng chữ"}
          </button>
          <button
            className={styles.resetButton}
            type="button"
            onClick={reset}
            disabled={state.status === "searching"}
          >
            Đặt lại
          </button>
        </div>

        <div className={styles.liveRegion} aria-live="polite">
          <p>{statusText}</p>
          {state.status === "error" && (
            <div className={styles.errorBox} role="alert">
              <strong>Không thể tìm kiếm</strong>
              <span>{state.message}</span>
              {state.traceId && <small>Mã tra cứu: {state.traceId}</small>}
            </div>
          )}
        </div>
      </form>

      <div className={styles.results} aria-label="Kết quả tìm kiếm bằng chữ">
        <h2>
          {state.status === "success"
            ? `${results.length} sản phẩm gần nhất`
            : "Kết quả sẽ xuất hiện tại đây"}
        </h2>
        {state.status === "success" && results.length === 0 && (
          <p className={styles.emptyState}>
            Catalog chưa có sản phẩm phù hợp với mô tả này.
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
              </li>
            ))}
          </ol>
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
