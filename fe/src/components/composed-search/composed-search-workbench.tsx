"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  CatalogDetailResponse,
  CatalogError,
} from "@/lib/catalog-contract";
import { detailHref, parseCatalogAnchor } from "@/lib/catalog-contract";
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

type AnchorState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; data: CatalogDetailResponse }
  | { status: "error"; message: string };


async function csrfToken(): Promise<{ header: string; token: string }> {
  const response = await fetch("/api/auth/csrf", { cache: "no-store" });
  if (!response.ok) throw new Error("Không thể bắt đầu phiên tìm kiếm.");
  const payload = (await response.json()) as { header_name: string; token: string };
  return { header: payload.header_name, token: payload.token };
}

export function ComposedSearchWorkbench() {
  const searchParams = useSearchParams();
  const parsedAnchor = parseCatalogAnchor(searchParams);
  const anchorParam = parsedAnchor.status === "valid" ? parsedAnchor.reference : null;
  const hasAnchor = parsedAnchor.status !== "absent";
  const anchorKey = JSON.stringify(["anchor_product_id", "anchor_product_version_id", "anchor_catalog_snapshot_id"]
    .map((name) => searchParams.getAll(name)));

  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const anchorRequestIdRef = useRef(0);
  const anchorAbortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [k, setK] = useState(10);
  const [modeChoice, setModeChoice] = useState<{ key: string; mode: "UPLOAD" | "PRODUCT" } | null>(null);
  const mode = modeChoice?.key === anchorKey ? modeChoice.mode : hasAnchor ? "PRODUCT" : "UPLOAD";
  const searchContextKey = JSON.stringify([anchorKey, mode]);
  const [anchorValidationNonce, setAnchorValidationNonce] = useState(0);
  const anchorValidationKey = `${anchorKey}:r${anchorValidationNonce}`;
  const [settledAnchor, setSettledAnchor] = useState<{ key: string; state: AnchorState } | null>(null);
  const [settledSearch, setSettledSearch] = useState<{ key: string; state: SearchState } | null>(null);
  const state: SearchState = settledSearch?.key === searchContextKey ? settledSearch.state : { status: "idle" };
  const setState = (next: SearchState) => setSettledSearch({ key: searchContextKey, state: next });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      abortRef.current?.abort();
      anchorAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    // Context owns both request acceptance and visible results. An A response
    // cannot survive in-place navigation to B, even before this effect runs.
    requestIdRef.current += 1;
    abortRef.current?.abort();
    return () => {
      requestIdRef.current += 1;
      abortRef.current?.abort();
    };
  }, [searchContextKey]);

  // Validate the anchor product against the detail API before preview or
  // submit. A stale, private or missing anchor fails visibly — never falls
  // back to another version or to an upload.
  useEffect(() => {
    if (!anchorParam || mode !== "PRODUCT") return;
    const key = anchorValidationKey;
    const requestId = anchorRequestIdRef.current + 1;
    anchorRequestIdRef.current = requestId;
    anchorAbortRef.current?.abort();
    const controller = new AbortController();
    anchorAbortRef.current = controller;

    const params = new URLSearchParams({
      product_version_id: anchorParam.productVersionId,
      catalog_snapshot_id: anchorParam.snapshotId,
    });
    fetch(
      `/api/catalog/products/${encodeURIComponent(anchorParam.productId)}?${params.toString()}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        if (anchorRequestIdRef.current !== requestId) return;
        const payload = (await response.json()) as
          | CatalogDetailResponse
          | CatalogError;
        if (anchorRequestIdRef.current !== requestId) return;
        if (!response.ok) {
          setSettledAnchor({
            key,
            state: {
              status: "error",
              message:
                response.status === 404
                  ? "Sản phẩm neo không còn trong publication đang công bố."
                  : response.status === 409
                    ? "Snapshot của sản phẩm neo đã thay đổi. Hãy chọn lại từ catalog."
                    : "Không xác thực được sản phẩm neo. Hãy thử lại.",
            },
          });
          return;
        }
        setSettledAnchor({
          key,
          state: { status: "ready", data: payload as CatalogDetailResponse },
        });
      })
      .catch((failure: unknown) => {
        if (anchorRequestIdRef.current !== requestId) return;
        if (failure instanceof DOMException && failure.name === "AbortError") return;
        setSettledAnchor({
          key,
          state: {
            status: "error",
            message: "Kết nối bị gián đoạn khi xác thực sản phẩm neo.",
          },
        });
      });

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey, anchorValidationKey, mode]);

  const anchor: AnchorState = parsedAnchor.status === "invalid"
    ? { status: "error", message: "Tham chiếu sản phẩm không đầy đủ hoặc không hợp lệ. Hãy mở lại từ catalog." }
    : !anchorParam
    ? { status: "none" }
    : settledAnchor && settledAnchor.key === anchorValidationKey
      ? settledAnchor.state
      : { status: "loading" };

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

  function switchMode(next: "UPLOAD" | "PRODUCT") {
    if (next === mode) return;
    requestIdRef.current += 1;
    abortRef.current?.abort();
    setModeChoice({ key: anchorKey, mode: next });
    if (next === "PRODUCT") setAnchorValidationNonce((value) => value + 1);
    setState({ status: "idle" });
    if (next === "UPLOAD") {
      setFile(null);
      replacePreview(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function reset() {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    setFile(null);
    replacePreview(null);
    setState({ status: "idle" });
    if (mode === "PRODUCT") setAnchorValidationNonce((value) => value + 1);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === "searching") return;

    if (mode === "PRODUCT") {
      if (!anchorParam) {
        setState({
          status: "error",
          message: "Thiếu sản phẩm neo. Hãy mở trang này từ chi tiết sản phẩm.",
        });
        return;
      }
      if (anchor.status !== "ready") {
        setState({
          status: "error",
          message:
            anchor.status === "error"
              ? anchor.message
              : "Đang xác thực sản phẩm neo, hãy đợi một chút.",
        });
        return;
      }
    } else {
      const violation = validateComposedInput({ file, text, k });
      if (violation) {
        setState({ status: "error", message: violation });
        return;
      }
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
      if (mode === "PRODUCT" && anchorParam) {
        // PRODUCT reference: exact anchor triple, strictly no image part.
        formData.set("modification_text", text);
        formData.set("k", String(k));
        formData.set("anchor_product_id", anchorParam.productId);
        formData.set("anchor_product_version_id", anchorParam.productVersionId);
        formData.set("anchor_catalog_snapshot_id", anchorParam.snapshotId);
      } else {
        formData.set("image", file as File);
        formData.set("modification_text", text);
        formData.set("k", String(k));
      }
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
        const stale =
          error.code === "ANCHOR_NOT_AVAILABLE" ||
          error.code === "ANCHOR_PUBLICATION_MISMATCH";
        setState({
          status: "error",
          message: stale
            ? "Sản phẩm neo đã thay đổi hoặc không còn khả dụng. Hãy chọn lại từ catalog."
            : error.message || "Tìm kiếm không hoàn tất. Hãy thử lại.",
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
  const snapshot = data?.publication.catalog_snapshot_id ?? "";
  const anchorReady = anchor.status === "ready" ? anchor.data : null;
  const statusText =
    state.status === "searching"
      ? "Đang đối chiếu ảnh và mô tả thay đổi…"
      : state.status === "success"
        ? `Tìm thấy ${results.length} sản phẩm, giữ nguyên thứ tự xếp hạng của API.`
        : mode === "PRODUCT"
          ? "Dùng sản phẩm đã chọn làm ảnh tham chiếu, nhập mô tả thay đổi."
          : "Chọn ảnh tham chiếu và nhập mô tả thay đổi.";

  return (
    <section className={styles.workbench} aria-label="Tìm kiếm composed trực tiếp">
      {hasAnchor && (
        <div className={styles.modeSwitch} role="group" aria-label="Chế độ tham chiếu">
          <button
            type="button"
            className={mode === "UPLOAD" ? `${styles.modeButton} ${styles.modeActive}` : styles.modeButton}
            aria-pressed={mode === "UPLOAD"}
            onClick={() => switchMode("UPLOAD")}
          >
            Tải ảnh lên
          </button>
          <button
            type="button"
            className={mode === "PRODUCT" ? `${styles.modeButton} ${styles.modeActive}` : styles.modeButton}
            aria-pressed={mode === "PRODUCT"}
            onClick={() => switchMode("PRODUCT")}
          >
            Dùng sản phẩm đã chọn
          </button>
        </div>
      )}

      {mode === "PRODUCT" && hasAnchor && (
        <div className={styles.anchorBox} aria-live="polite">
          {anchor.status === "loading" && <p>Đang xác thực sản phẩm đã chọn…</p>}
          {anchor.status === "error" && (
            <p className={styles.anchorError} role="alert">
              {anchor.message}
            </p>
          )}
          {anchorReady && (
            <div className={styles.anchorPreview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={anchorReady.image_url} alt={anchorReady.title} />
              <div>
                <span className={styles.cardCategory}>
                  Tham chiếu · {categoryNames[anchorReady.category]}
                </span>
                <strong>{anchorReady.title}</strong>
                <span className={styles.anchorMeta}>
                  {anchorReady.product_id} · {anchorReady.product_version_id}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        {mode === "UPLOAD" && (
          <>
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
          </>
        )}

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
                <Link
                  href={`${detailHref(
                    product.product_id,
                    product.product_version_id,
                    snapshot,
                  )}&return_to=${encodeURIComponent("/search/composed")}`}
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
                        Mức tương đồng {(product.similarity_score * 100).toFixed(1)}% ·{" "}
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
