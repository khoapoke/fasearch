"use client";

import {
  ChangeEvent,
  CSSProperties,
  DragEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  FashionCategory,
  ImageSearchResponse,
  SearchError,
} from "@/lib/search-contract";
import styles from "./image-search-workbench.module.css";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const categoryNames: Record<FashionCategory, string> = {
  TOP: "Áo",
  BOTTOM: "Quần / váy rời",
  ONE_PIECE: "Trang phục liền",
};

type SearchState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "success"; data: ImageSearchResponse }
  | { status: "error"; message: string; traceId?: string };

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
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || state.status === "searching") return;

    setState({ status: "searching" });
    const formData = new FormData();
    formData.set("image", file);
    formData.set("k", "8");

    try {
      const response = await fetch("/api/search/image", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as ImageSearchResponse | SearchError;
      if (!response.ok) {
        const error = payload as SearchError;
        setState({
          status: "error",
          message: error.message || "Tìm kiếm không hoàn tất. Hãy thử lại.",
          traceId: error.trace_id ?? undefined,
        });
        return;
      }
      setState({ status: "success", data: payload as ImageSearchResponse });
    } catch {
      setState({
        status: "error",
        message: "Kết nối bị gián đoạn. Kiểm tra lại và thử một lần nữa.",
      });
    }
  }

  function reset() {
    setFile(null);
    replacePreview(null);
    setState({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  const results = state.status === "success" ? state.data.results : [];

  return (
    <section className={styles.workbench} aria-label="Tìm kiếm bằng hình ảnh">
      <form className={styles.queryPanel} onSubmit={handleSubmit}>
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.kicker}>Ảnh truy vấn</p>
            <h2>Đặt sản phẩm vào khung</h2>
          </div>
          <span>JPEG · PNG · WebP</span>
        </div>

        <label
          className={`${styles.dropzone} ${isDragging ? styles.dragging : ""} ${previewUrl ? styles.hasPreview : ""}`}
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
                +
              </span>
              <strong>Thả ảnh vào đây</strong>
              <span>hoặc nhấn để chọn từ máy</span>
            </span>
          )}
        </label>

        <div className={styles.fileRow}>
          <div>
            <span className={styles.fileName}>{file?.name ?? "Chưa chọn ảnh"}</span>
            <span className={styles.fileMeta}>
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MiB` : "Tối đa 10 MiB"}
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
          {state.status === "error" && (
            <div className={styles.errorBox} role="alert">
              <strong>Không thể tìm kiếm</strong>
              <span>{state.message}</span>
              {state.traceId && <small>Mã tra cứu: {state.traceId}</small>}
            </div>
          )}
        </div>
      </form>

      <aside className={styles.processRail} aria-label="Quy trình tìm kiếm">
        <div>
          <p className={styles.railTitle}>Luồng đang chạy</p>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>Đọc ảnh</strong>
                <p>Kiểm tra định dạng và tạo vector truy vấn.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Xếp hạng</strong>
                <p>Đối chiếu trên cùng model, index và catalog version.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Ghép thông tin</strong>
                <p>Backend bổ sung thông tin sản phẩm đang hoạt động.</p>
              </div>
            </li>
          </ol>
        </div>
        <p className={styles.privacyNote}>
          Ảnh truy vấn chỉ phục vụ lần tìm kiếm này trong slice hiện tại.
        </p>
      </aside>

      <div className={styles.results}>
        <div className={styles.resultsHeading}>
          <div>
            <p className={styles.kicker}>Kết quả</p>
            <h2>
              {state.status === "success"
                ? `${results.length} sản phẩm gần nhất`
                : "Kết quả sẽ xuất hiện tại đây"}
            </h2>
          </div>
          {state.status === "success" && (
            <div className={styles.latency}>
              <span>{state.data.latency.total_latency_ms.toFixed(0)} ms</span>
              toàn tuyến backend
            </div>
          )}
        </div>

        {state.status === "success" && results.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>Catalog chưa có sản phẩm phù hợp.</strong>
            <span>Thử một ảnh rõ toàn bộ trang phục và ít vật thể nền hơn.</span>
          </div>
        ) : results.length > 0 ? (
          <div className={styles.resultGrid}>
            {results.map((product) => (
              <article
                className={styles.productCard}
                key={`${product.product_id}:${product.product_version_id}`}
              >
                <div
                  className={styles.productImage}
                  style={
                    {
                      "--product-image": `url(${product.image_url})`,
                    } as CSSProperties
                  }
                  role="img"
                  aria-label={product.title}
                >
                  <span className={styles.rank}>{product.rank}</span>
                </div>
                <div className={styles.productInfo}>
                  <span>{categoryNames[product.category]}</span>
                  <h3>{product.title}</h3>
                  <div className={styles.scoreRow}>
                    <span>Mức tương đồng</span>
                    <strong>{(product.similarity_score * 100).toFixed(1)}%</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.resultPlaceholder} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}

        {state.status === "success" && (
          <div className={styles.provenance}>
            <span>Catalog: {state.data.publication.catalog_snapshot_id}</span>
            <span>Index: {state.data.publication.index_version}</span>
            <span>Trace: {state.data.trace_id}</span>
          </div>
        )}
      </div>
    </section>
  );
}
