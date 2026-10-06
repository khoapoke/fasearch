"use client";

import {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  ImageSearchResponse,
  SearchError,
} from "@/lib/search-contract";
import { detailHref } from "@/lib/catalog-contract";
import { decidePaste, type PasteTarget } from "@/lib/clipboard-image";
import { SaveButton } from "@/components/library/save-button";
import { ResultCard } from "./stitch-search/result-card";
import { createRequestGuard } from "./stitch-search/request-guard";
import styles from "./image-search-workbench.module.css";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type SearchState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "success"; data: ImageSearchResponse; historyStatus: string }
  | { status: "error"; message: string; traceId?: string };

async function csrfToken(): Promise<{ header: string; token: string }> {
  const response = await fetch("/api/auth/csrf", { cache: "no-store" });
  if (!response.ok) throw new Error("Không thể bắt đầu phiên tìm kiếm.");
  const payload = (await response.json()) as { header_name: string; token: string };
  return { header: payload.header_name, token: payload.token };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Chọn ảnh JPEG, PNG hoặc WebP.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Ảnh phải nhỏ hơn hoặc bằng 10 MiB.";
  }
  if (file.size === 0) {
    return "Ảnh đang trống. Hãy chọn một tệp khác.";
  }
  return null;
}

export function ImageSearchWorkbench() {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const guardRef = useRef<ReturnType<typeof createRequestGuard> | null>(null);
  if (guardRef.current === null) guardRef.current = createRequestGuard();
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

  // A new selection supersedes any pending request: invalidate its ticket and
  // cancel its fetch so a slow earlier response cannot replace this state.
  function selectFile(nextFile: File | undefined) {
    if (!nextFile) return;
    guardRef.current?.invalidate();
    abortRef.current?.abort();
    const validationError = validateFile(nextFile);
    if (validationError) {
      setFile(null);
      replacePreview(null);
      setState({ status: "error", message: validationError });
      return;
    }
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

  // Ctrl/Cmd+V on the dropzone reuses the exact file pipeline (validate,
  // preview, guard invalidation). Editable targets keep native behavior;
  // links/rich content are rejected visibly and never fetched.
  function handlePaste(event: ClipboardEvent<HTMLLabelElement>) {
    const decision = decidePaste(event.target as unknown as PasteTarget, event.clipboardData);
    if (decision.kind === "ignored") return;
    event.preventDefault();
    if (decision.kind === "image") {
      selectFile(decision.file);
      return;
    }
    guardRef.current?.invalidate();
    setState({
      status: "error",
      message:
        "Chỉ nhận ảnh dán trực tiếp (JPEG, PNG, WebP). Liên kết và văn bản không được tải làm ảnh.",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const guard = guardRef.current;
    if (!file || !guard || state.status === "searching") return;

    const ticket = guard.begin();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "searching" });
    const formData = new FormData();
    formData.set("image", file);
    formData.set("k", "8");

    try {
      const csrf = await csrfToken();
      if (!guard.isCurrent(ticket)) return;
      const response = await fetch("/api/search/image", {
        method: "POST",
        headers: { [csrf.header]: csrf.token },
        body: formData,
        signal: controller.signal,
      });
      if (!guard.isCurrent(ticket)) return;
      const payload = (await response.json()) as ImageSearchResponse | SearchError;
      if (!guard.isCurrent(ticket)) return;
      if (!response.ok) {
        const error = payload as SearchError;
        setState({
          status: "error",
          message: error.message || "Tìm kiếm không hoàn tất. Hãy thử lại.",
          traceId: error.trace_id ?? undefined,
        });
        return;
      }
      setState({
        status: "success",
        data: payload as ImageSearchResponse,
        historyStatus: response.headers.get("x-history-status") ?? "NOT_RECORDED",
      });
    } catch (failure) {
      if (!guard.isCurrent(ticket)) return;
      if (failure instanceof DOMException && failure.name === "AbortError") return;
      setState({
        status: "error",
        message: "Kết nối bị gián đoạn. Kiểm tra lại và thử một lần nữa.",
      });
    }
  }

  function reset() {
    guardRef.current?.invalidate();
    abortRef.current?.abort();
    setFile(null);
    replacePreview(null);
    setState({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  const results = state.status === "success" ? state.data.results : [];
  const snapshot =
    state.status === "success" ? state.data.publication.catalog_snapshot_id : "";
  const statusText =
    state.status === "searching"
      ? "Đang đối chiếu catalog…"
      : state.status === "success"
        ? `Tìm thấy ${results.length} sản phẩm gần nhất, giữ nguyên thứ tự xếp hạng của API.`
        : file
          ? `Đã chọn ảnh ${file.name}. Nhấn “Tìm sản phẩm tương đồng” để bắt đầu.`
          : "Chưa chọn ảnh.";

  return (
    <section
      id="tim-bang-anh"
      className={styles.section}
      aria-label="Tìm kiếm bằng hình ảnh"
    >
      <div className={styles.card}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Tìm bằng ảnh</p>
          <h2>Bắt gặp outfit đẹp? Thả ảnh vào đây để tìm đồ tương tự.</h2>
          <p className={styles.lede}>
            Không cần biết tên sản phẩm hay thuật ngữ thời trang. Ảnh truy vấn
            chỉ phục vụ lần tìm kiếm này.
          </p>
        </div>

        <div className={styles.columns}>
          <div className={styles.info}>
            <ul className={styles.facts}>
              <li>JPEG, PNG hoặc WebP — tối đa 10 MiB mỗi ảnh</li>
              <li>Kéo thả hoặc nhấn để chọn, xem trước rồi mới tìm</li>
              <li>Mẹo: focus khung ảnh rồi nhấn Ctrl+V / ⌘V để dán ảnh</li>
              <li>Kết quả giữ nguyên thứ tự xếp hạng của API</li>
            </ul>
            <dl className={styles.stats}>
              <div>
                <dt>Kết quả mỗi lần tìm</dt>
                <dd>08</dd>
              </div>
              <div>
                <dt>Giới hạn ảnh</dt>
                <dd>10 MiB</dd>
              </div>
              <div>
                <dt>Danh mục catalog</dt>
                <dd>03</dd>
              </div>
            </dl>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label
              className={`${styles.dropzone} ${isDragging ? styles.dragging : ""} ${previewUrl ? styles.hasPreview : ""}`}
              tabIndex={0}
              onPaste={handlePaste}
              aria-label="Khung ảnh truy vấn. Focus rồi nhấn Ctrl V để dán ảnh từ clipboard."
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
                aria-label="Chọn ảnh truy vấn JPEG, PNG hoặc WebP, tối đa 10 MiB"
              />
              {previewUrl ? (
                <>
                  <span
                    className={styles.preview}
                    style={{ backgroundImage: `url(${previewUrl})` }}
                    role="img"
                    aria-label={`Ảnh xem trước: ${file?.name ?? "ảnh truy vấn"}`}
                  />
                  <span className={styles.replaceHint}>Chọn ảnh khác</span>
                </>
              ) : (
                <span className={styles.dropCopy}>
                  <span className={styles.uploadGlyph} aria-hidden="true">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </span>
                  <strong>Kéo thả ảnh vào đây</strong>
                  <span>hoặc nhấn để chọn từ máy</span>
                  <span className={styles.pasteHint}>Hoặc focus khung này rồi nhấn Ctrl+V / ⌘V để dán ảnh</span>
                </span>
              )}
            </label>

            <div className={styles.fileRow}>
              <div>
                <span className={styles.fileName}>{file?.name ?? "Chưa chọn ảnh"}</span>
                <span className={styles.fileMeta}>
                  {file ? formatBytes(file.size) : "Tối đa 10 MiB"}
                </span>
              </div>
              {file && (
                <button className={styles.clearButton} type="button" onClick={reset}>
                  Bỏ ảnh
                </button>
              )}
            </div>

            <button
              className={styles.searchButton}
              type="submit"
              disabled={!file || state.status === "searching"}
            >
              {state.status === "searching" ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Đang đối chiếu catalog
                </>
              ) : (
                "Tìm sản phẩm tương đồng"
              )}
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
        </div>

        <div id="ket-qua" className={styles.results}>
          <div className={styles.resultsHeading}>
            <div>
              <p className={styles.eyebrow}>Kết quả</p>
              <h2>
                {state.status === "success"
                  ? `${results.length} sản phẩm gần nhất`
                  : "Kết quả sẽ xuất hiện tại đây"}
              </h2>
            </div>
            {state.status === "success" && (
              <p className={styles.latency}>
                <span>{state.data.latency.total_latency_ms.toFixed(0)} ms</span>
                toàn tuyến backend
              </p>
            )}
          </div>

          {state.status === "success" && results.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>Catalog chưa có sản phẩm phù hợp.</strong>
              <span>Thử một ảnh rõ toàn bộ trang phục và ít vật thể nền hơn.</span>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className={styles.resultGrid}>
                {results.map((product) => (
                  <div
                    key={`${product.product_id}:${product.product_version_id}`}
                    className={styles.resultCell}
                  >
                    <ResultCard
                      product={product}
                      href={`${detailHref(
                        product.product_id,
                        product.product_version_id,
                        snapshot,
                      )}&return_to=${encodeURIComponent("/")}`}
                    />
                    <SaveButton productId={product.product_id} title={product.title} />
                  </div>
                ))}
              </div>
              {state.status === "success" && state.historyStatus === "RECORDED" && (
                <p className={styles.historyNote}>
                  Đã lưu lần tìm này vào lịch sử của bạn.
                </p>
              )}
              <p className={styles.similarityNote}>
                “Mức tương đồng” là độ tương đồng thô từ mô hình, không phải
                xác suất hay độ chính xác.
              </p>
            </>
          ) : (
            <div className={styles.resultPlaceholder} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          )}

          {state.status === "success" && (
            <details className={styles.diagnostics}>
              <summary>Chi tiết chẩn đoán &amp; truy vết</summary>
              <dl>
                <div>
                  <dt>Catalog snapshot</dt>
                  <dd>{state.data.publication.catalog_snapshot_id}</dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>{state.data.publication.model_version}</dd>
                </div>
                <div>
                  <dt>Index</dt>
                  <dd>{state.data.publication.index_version}</dd>
                </div>
                <div>
                  <dt>Trace</dt>
                  <dd>{state.data.trace_id}</dd>
                </div>
                <div>
                  <dt>Độ trễ AI / toàn tuyến</dt>
                  <dd>
                    {state.data.latency.ai_latency_ms.toFixed(0)} ms /{" "}
                    {state.data.latency.total_latency_ms.toFixed(0)} ms
                  </dd>
                </div>
              </dl>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}
