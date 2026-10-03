"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  ComposedSearchError,
  ComposedSearchResponse,
  FashionCategory,
} from "@/lib/search-contract";
import {
  MAX_TEXT_CODE_POINTS,
  codePointCount,
  validateComposedInput,
} from "./validation";
import styles from "./composed-search-workbench.module.css";

const categoryNames: Record<FashionCategory, string> = {
  TOP: "Áo",
  BOTTOM: "Quần / váy rời",
  ONE_PIECE: "Trang phục liền",
};

type SearchState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "success"; data: ComposedSearchResponse }
  | { status: "error"; message: string; traceId?: string };

async function csrfToken(): Promise<{ header: string; token: string }> {
  const response = await fetch("/api/auth/csrf", { cache: "no-store" });
  if (!response.ok) throw new Error("Không thể bắt đầu phiên tìm kiếm.");
  const payload = (await response.json()) as { header_name: string; token: string };
  return { header: payload.header_name, token: payload.token };
}

export function ComposedSearchWorkbench() {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [k, setK] = useState(10);
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function replacePreview(nextFile: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextUrl = nextFile ? URL.createObjectURL(nextFile) : null;
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  }

  function selectFile(nextFile: File | undefined) {
    if (!nextFile) return;
    requestIdRef.current += 1;
    abortRef.current?.abort();
    setFile(nextFile);
    replacePreview(nextFile);
    setState({ status: "idle" });
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  }

  function reset() {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    setFile(null);
    replacePreview(null);
    setState({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === "searching") return;
    const violation = validateComposedInput({ file, text, k });
    if (violation) {
      setState({ status: "error", message: violation });
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "searching" });

    try {
      const csrf = await csrfToken();
      if (requestIdRef.current !== requestId) return;
      const formData = new FormData();
      formData.set("schema_version", "1.0.0");
      formData.set("image", file as File);
      formData.set("modification_text", text);
      formData.set("k", String(k));
      const response = await fetch("/api/search/composed", {
        method: "POST",
        headers: { [csrf.header]: csrf.token },
        body: formData,
        signal: controller.signal,
      });
      if (requestIdRef.current !== requestId) return;
      const payload = (await response.json()) as
        | ComposedSearchResponse
        | ComposedSearchError;
      if (requestIdRef.current !== requestId) return;
      if (!response.ok) {
        const error = payload as ComposedSearchError;
        setState({
          status: "error",
          message: error.message || "Tìm kiếm không hoàn tất. Hãy thử lại.",
          traceId: error.trace_id ?? undefined,
        });
        return;
      }
      setState({ status: "success", data: payload as ComposedSearchResponse });
    } catch (failure) {
      if (requestIdRef.current !== requestId) return;
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
      ? "Đang đối chiếu ảnh và mô tả thay đổi…"
      : state.status === "success"
        ? `Tìm thấy ${results.length} sản phẩm, giữ nguyên thứ tự xếp hạng của API.`
        : "Chọn ảnh tham chiếu và nhập mô tả thay đổi.";

  return (
    <section className={styles.workbench} aria-label="Tìm kiếm composed trực tiếp">
      <form className={styles.form} onSubmit={handleSubmit}>
        <label
          className={`${styles.dropzone} ${isDragging ? styles.dragging : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            className={styles.fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleInput}
            aria-label="Chọn ảnh tham chiếu JPEG, PNG hoặc WebP, tối đa 10 MiB"
          />
          {previewUrl ? (
            <span
              className={styles.preview}
              style={{ backgroundImage: `url(${previewUrl})` }}
              role="img"
              aria-label={`Ảnh tham chiếu: ${file?.name ?? ""}`}
            />
          ) : (
            <span className={styles.dropCopy}>
              <strong>Thả ảnh tham chiếu vào đây</strong>
              <span>hoặc nhấn để chọn từ máy</span>
            </span>
          )}
        </label>

        <div className={styles.fileRow}>
          <span className={styles.fileName}>{file?.name ?? "Chưa chọn ảnh"}</span>
          {file && (
            <button className={styles.clearButton} type="button" onClick={reset}>
              Bỏ ảnh
            </button>
          )}
        </div>

        <label className={styles.textLabel}>
          Mô tả thay đổi mong muốn
          <textarea
            className={styles.textInput}
            value={text}
            maxLength={MAX_TEXT_CODE_POINTS + 16}
            rows={3}
            placeholder="Ví dụ: đổi sang màu navy, tay dài hơn"
            onChange={(event) => setText(event.target.value)}
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
          />
        </label>

        <button
          className={styles.searchButton}
          type="submit"
          disabled={state.status === "searching"}
        >
          {state.status === "searching" ? "Đang tìm kiếm…" : "Tìm bằng ảnh + chữ"}
        </button>

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

      <div className={styles.results} aria-label="Kết quả composed">
        <h2>
          {state.status === "success"
            ? `${results.length} sản phẩm gần nhất`
            : "Kết quả sẽ xuất hiện tại đây"}
        </h2>
        {state.status === "success" && results.length === 0 && (
          <p className={styles.emptyState}>
            Catalog chưa có sản phẩm phù hợp với ảnh và mô tả này.
          </p>
        )}
        {results.length > 0 && (
          <ol className={styles.resultList}>
            {results.map((product) => (
              <li key={`${product.product_id}:${product.product_version_id}`}>
                <article className={styles.card}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.image_url} alt={product.title} loading="lazy" />
                  <div>
                    <span className={styles.cardCategory}>
                      Hạng {product.rank} · {categoryNames[product.category]}
                    </span>
                    <h3>{product.title}</h3>
                    <p>
                      Mức tương đồng {(product.similarity_score * 100).toFixed(1)}% ·{" "}
                      {product.product_id}
                    </p>
                  </div>
                </article>
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
                <dt>Tham chiếu</dt>
                <dd>
                  {data.reference.type}
                  {data.reference.product_id
                    ? ` · ${data.reference.product_id}:${data.reference.product_version_id}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt>Chính sách tràn chữ / tự khớp</dt>
                <dd>
                  {data.provenance.text_overflow_policy} /{" "}
                  {data.provenance.self_match_policy}
                </dd>
              </div>
              <div>
                <dt>Fusion</dt>
                <dd>
                  {data.provenance.fusion.fusion_version} ·{" "}
                  {data.provenance.fusion.image_weight}/
                  {data.provenance.fusion.text_weight}
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
