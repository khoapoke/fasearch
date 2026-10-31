"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { authMe, type AuthIdentity } from "@/lib/customer-auth-client";
import { recordSearchHistory } from "@/lib/customer-account-client";
import { searchAi, type AiSearchMode } from "@/lib/ai-client";
import { parseAiResults, validateQuery, type AiHit } from "@/lib/ai-search";
import {
  AI_MAX_BYTES,
  checkImageDimensions,
  validateComposed,
  validateImageFile,
  type AiMode,
} from "@/lib/ai-full";
import {
  AI_EXAMPLES,
  AI_MODE_HINTS,
  AI_PHOTOS,
  MOCK_RESULTS,
  type AiPhoto,
  type PreviewState,
} from "./ai-fixtures";
import "./ai-page.css";

/* ---------- Icons: exact 20x20 reference geometry (app.js icon()) ---------- */

function AiSearchIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="8.8" cy="8.8" r="5.8" />
      <path d="m13.2 13.2 4 4" />
    </svg>
  );
}

function AiUploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M10 13V3m-4 4 4-4 4 4M3 12v5h14v-5" />
    </svg>
  );
}

function AiZoomIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m13 13 4 4M6 8.5h5M8.5 6v5" />
    </svg>
  );
}

/* ---------- Media with explicit failure states ---------- */

function AiPhotoFrame({
  photo,
  className,
  eager = false,
  forceFail = false,
}: {
  photo: AiPhoto;
  className?: string;
  eager?: boolean;
  forceFail?: boolean;
}) {
  const [failed, setFailed] = useState(forceFail);
  if (failed) {
    return (
      <span className="ai-img-fail" role="img" aria-label={`Không tải được ảnh: ${photo.alt}`}>
        Không tải được ảnh minh họa
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ảnh Unsplash/minh họa, không qua Image optimizer
    <img
      className={className}
      src={photo.src}
      alt={photo.alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

type DoneState = {
  kind: "done";
  hits: AiHit[];
  label: string;
  mock?: boolean;
  failImages?: boolean;
  photos?: Record<string, AiPhoto>;
};

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | DoneState
  | { kind: "error"; message: string }
  | { kind: "session"; message: string }
  | { kind: "forbidden"; message: string };

type FieldError = { message: string; target: "query" | "file" } | null;

function mockHits(): { hits: AiHit[]; photos: Record<string, AiPhoto> } {
  const photos: Record<string, AiPhoto> = {};
  const hits = MOCK_RESULTS.map((item) => {
    const photo = AI_PHOTOS[item.photo];
    photos[item.sourceId] = photo;
    return {
      sourceId: item.sourceId,
      score: item.score,
      fileName: item.fileName,
      catalog: null,
      imageUrl: photo.src,
      tenHienThi: item.title,
      thuocTinh: null,
      nguonDuLieu: "Dữ liệu minh họa (mock)",
      phienBanDuLieu: "preview",
      maSpLienKet: null,
    } satisfies AiHit;
  });
  return { hits, photos };
}

function previewSearchState(preview: PreviewState | null): SearchState {
  if (!preview) return { kind: "idle" };
  if (preview === "pending") return { kind: "loading" };
  if (preview === "results" || preview === "imagefail") {
    const { hits, photos } = mockHits();
    return {
      kind: "done",
      hits,
      label: "“Áo thun đen, dáng rộng, phối quần jeans”",
      mock: true,
      failImages: preview === "imagefail",
      photos,
    };
  }
  if (preview === "empty") {
    return { kind: "done", hits: [], label: "“Áo màu trắng, dáng rộng”", mock: true };
  }
  if (preview === "error") return { kind: "error", message: "Không thể tìm kiếm mẫu. Hãy thử lại." };
  if (preview === "session") return { kind: "session", message: "Phiên đăng nhập đã hết. Đăng nhập lại rồi tìm tiếp." };
  if (preview === "forbidden") return { kind: "forbidden", message: "Tài khoản của bạn không có quyền tìm bằng AI." };
  return { kind: "idle" };
}

function errorMessage(status: number): string {
  if (status === 400) return "Yêu cầu chưa hợp lệ. Kiểm tra mô tả/ảnh rồi thử lại.";
  if (status === 413) return "Ảnh quá lớn. Chọn ảnh nhỏ hơn rồi thử lại.";
  if (status === 415) return "Định dạng ảnh chưa được hỗ trợ. Chọn ảnh JPEG hoặc PNG.";
  if (status === 502) return "Máy chủ trả về không đúng định dạng. Thử lại sau ít phút.";
  if (status === 503) return "Tìm kiếm AI tạm thời chưa sẵn sàng. Thử lại sau ít phút.";
  return "Không kết nối được máy chủ. Giữ nguyên đầu vào rồi thử lại.";
}

/* ---------- Result media + zoom dialog ---------- */

function ResultMedia({
  hit,
  photo,
  failImages,
  onZoom,
}: {
  hit: AiHit;
  photo?: AiPhoto;
  failImages?: boolean;
  onZoom: (trigger: HTMLButtonElement) => void;
}) {
  const title = hit.tenHienThi ?? hit.fileName;
  const [failed, setFailed] = useState(failImages || !hit.imageUrl);
  if (failed || !hit.imageUrl) {
    return (
      <span className="result-image-fail" role="img" aria-label={`Không tải được ảnh: ${title}`}>
        Không tải được ảnh AI
      </span>
    );
  }
  return (
    <button
      className="result-image-button"
      type="button"
      aria-label={`Phóng to ảnh ${title}`}
      onClick={(event) => onZoom(event.currentTarget)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh AI qua proxy/minh họa */}
      <img
        className="result-image"
        src={hit.imageUrl}
        alt={photo?.alt ?? `Ảnh AI: ${hit.fileName}`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
      <span className="image-zoom" aria-hidden="true">
        <AiZoomIcon />
      </span>
    </button>
  );
}

function AiImageDialog({
  viewer,
  onClose,
}: {
  viewer: { src: string; alt: string; caption: string; trigger: HTMLButtonElement } | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (viewer && !dialog.open) {
      setFailed(false);
      dialog.showModal();
    } else if (!viewer && dialog.open) {
      dialog.close();
    }
  }, [viewer]);

  return (
    <dialog
      ref={dialogRef}
      className="ai-dialog"
      aria-labelledby="ai-dialog-title"
      onClose={onClose}
    >
      <div className="ai-dialog-head">
        <h2 id="ai-dialog-title">Xem ảnh</h2>
        <button
          className="ai-dialog-close"
          type="button"
          aria-label="Đóng ảnh phóng to"
          onClick={() => dialogRef.current?.close()}
        >
          ✕
        </button>
      </div>
      <div className="ai-dialog-media">
        {viewer ? (
          failed ? (
            <p className="ai-dialog-fail" role="img" aria-label={`Không tải được ảnh: ${viewer.alt}`}>
              Không tải được ảnh này. Đóng hộp thoại rồi thử kết quả khác.
            </p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh AI/minh họa
            <img
              src={viewer.src}
              alt={viewer.alt}
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
            />
          )
        ) : null}
      </div>
      <p className="ai-dialog-caption">{viewer?.caption}</p>
    </dialog>
  );
}

/* ---------- Example board ---------- */

function ExamplesBoard({
  selected,
  onPick,
}: {
  selected: string;
  onPick: (exampleId: string) => void;
}) {
  return (
    <>
      <div className="examples-heading">
        <h2>Gợi ý để bắt đầu</h2>
        <p>Chọn một ảnh để thử bằng chữ.</p>
      </div>
      <div className="examples-board">
        {AI_EXAMPLES.map((example) => (
          <button
            key={example.id}
            className={`search-example ${example.layout}`}
            type="button"
            aria-pressed={selected === example.id}
            aria-label={`Dùng mô tả ${example.query}: chuyển sang tìm bằng chữ, điền vào ô mô tả, chưa tìm ngay`}
            onClick={() => onPick(example.id)}
          >
            <span className="example-image">
              <AiPhotoFrame photo={AI_PHOTOS[example.photo]} />
            </span>
            <span className="example-caption">
              <span>{example.title}</span>
              <span className="example-use" aria-hidden="true">
                <span className="use-verb">Dùng mô tả</span><AiSearchIcon size={17} />
              </span>
            </span>
          </button>
        ))}
      </div>
      <details className="source-disclosure">
        <summary>Nguồn ảnh</summary>
        <div>
          {[...new Set(AI_EXAMPLES.map((example) => example.photo))].map((key) => {
            const photo = AI_PHOTOS[key];
            return (
              <a className="photo-credit" key={key} href={photo.page} target="_blank" rel="noopener noreferrer">
                Ảnh Unsplash · {photo.author}
              </a>
            );
          })}
        </div>
      </details>
    </>
  );
}

/* ---------- Main view ---------- */

export function AiSearchView({ preview }: { preview: PreviewState | null }) {
  const isPreview = Boolean(preview);
  const [me, setMe] = useState<AuthIdentity | null>(null);
  const [checking, setChecking] = useState(!isPreview);
  const [mode, setMode] = useState<AiMode>("text");
  const [query, setQuery] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<SearchState>(() => previewSearchState(preview));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [fieldError, setFieldError] = useState<FieldError>(null);
  const [selectedExample, setSelectedExample] = useState("");
  const [viewer, setViewer] = useState<{ src: string; alt: string; caption: string; trigger: HTMLButtonElement } | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  const generationRef = useRef(0);
  const opRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPreview) return;
    let live = true;
    authMe()
      .then((identity) => {
        if (live) {
          setMe(identity);
          setChecking(false);
        }
      })
      .catch(() => {
        if (live) setChecking(false);
      });
    return () => {
      live = false;
    };
  }, [isPreview]);

  useEffect(() => {
    if (state.kind === "error" || state.kind === "session" || state.kind === "forbidden") errorRef.current?.focus();
  }, [state]);

  // Object URL cleanup on replace/unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Owner-aware cleanup: unmount invalidates any in-flight generation and aborts it.
  useEffect(() => {
    return () => {
      generationRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      opRef.current = null;
    };
  }, []);

  // Input/mode/example/remove changes invalidate obsolete async work. A pending
  // operation is cancelled; completed output is left visible for the user.
  function invalidatePending() {
    generationRef.current += 1;
    if (opRef.current !== null) {
      abortRef.current?.abort();
      abortRef.current = null;
      opRef.current = null;
    }
    setState((current) => (current.kind === "loading" ? { kind: "idle" } : current));
  }

  function isOwner(owner: number) {
    return generationRef.current === owner && opRef.current === owner;
  }

  function setFileError(message: string) {
    setFieldError({ message, target: "file" });
    requestAnimationFrame(() => fileInputRef.current?.focus());
  }

  function onFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    invalidatePending();
    const next = files[0];
    try {
      validateImageFile(next);
    } catch (error) {
      setFieldError({ message: error instanceof Error ? error.message : "Ảnh chưa hợp lệ.", target: "file" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setPreviewFailed(false);
    setFieldError(null);
    setState({ kind: "idle" });
  }

  function removeFile() {
    invalidatePending();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setPreviewFailed(false);
    setFieldError(null);
    setState({ kind: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
    requestAnimationFrame(() => fileInputRef.current?.focus());
  }

  function pickExample(exampleId: string) {
    const example = AI_EXAMPLES.find((item) => item.id === exampleId);
    if (!example) return;
    invalidatePending();
    setSelectedExample(example.id);
    setMode("text");
    setQuery(example.query);
    setFieldError(null);
    setState({ kind: "idle" });
    requestAnimationFrame(() => queryRef.current?.focus());
  }

  async function decodeCheck(next: File): Promise<void> {
    const url = URL.createObjectURL(next);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Không đọc được ảnh. Chọn JPEG/PNG khác."));
        image.src = url;
      });
      checkImageDimensions(image.naturalWidth, image.naturalHeight);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function focusSearchField() {
    if (mode === "image") fileInputRef.current?.focus();
    else queryRef.current?.focus();
  }

  function focusField(target: "query" | "file") {
    requestAnimationFrame(() => {
      if (target === "query") queryRef.current?.focus();
      else fileInputRef.current?.focus();
    });
  }

  async function run(event?: FormEvent) {
    event?.preventDefault();
    if (isPreview || checking || opRef.current !== null) return;

    let label = "";
    let searchMode: AiSearchMode = "text";
    let body: BodyInit | undefined = undefined;
    let decodeFile: File | null = null;
    const limit = 5; // Reference không có control limit; API 1–5 giữ nguyên, mặc định 5.
    let recordedQuery = "";

    setFieldError(null);

    // Synchronous validation trước khi chiếm lock: lỗi field/auth không để lại lock.
    if (mode === "text") {
      let q: string;
      try {
        q = validateQuery(query);
        recordedQuery = q;
      } catch (error) {
        setFieldError({ message: error instanceof Error ? error.message : "Mô tả chưa hợp lệ.", target: "query" });
        focusField("query");
        return;
      }
      label = `“${q}”`;
      searchMode = "text";
      body = JSON.stringify({ query: q, limit });
    } else if (mode === "image") {
      if (!file) {
        setFileError("Chọn 1 ảnh JPEG/PNG ≤5MiB để tìm bằng ảnh.");
        return;
      }
      try {
        validateImageFile(file);
      } catch (error) {
        setFileError(error instanceof Error ? error.message : "Ảnh chưa hợp lệ.");
        return;
      }
      decodeFile = file;
      label = `Ảnh tham chiếu “${file.name}”`;
      searchMode = "image";
      recordedQuery = file.name;
      const form = new FormData();
      form.append("file", file);
      form.append("limit", String(limit));
      body = form;
    } else {
      if (!file) {
        setFileError("Chế độ kết hợp cần 1 ảnh JPEG/PNG ≤5MiB.");
        return;
      }
      try {
        validateImageFile(file);
      } catch (error) {
        setFileError(error instanceof Error ? error.message : "Ảnh chưa hợp lệ.");
        return;
      }
      let q = "";
      try {
        q = validateComposed(query, file).q;
        recordedQuery = q;
      } catch (error) {
        setFieldError({ message: error instanceof Error ? error.message : "Từ khóa chưa hợp lệ.", target: "query" });
        focusField("query");
        return;
      }
      decodeFile = file;
      label = `“${q}” + ảnh “${file.name}”`;
      searchMode = "multimodal";
      const form = new FormData();
      form.append("file", file);
      form.append("query", q);
      form.append("limit", String(limit));
      body = form;
    }

    if (!me) {
      setState({ kind: "session", message: "Cần đăng nhập để tìm bằng AI." });
      return;
    }

    // Lock BEFORE the first await (image/composed decode included). A second
    // synchronous submit sees opRef and returns; UI shows loading immediately.
    const owner = ++generationRef.current;
    opRef.current = owner;
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: "loading" });
    setSelectedIds(new Set());
    let stage: "decode" | "request" | "json" = "decode";

    try {
      if (decodeFile) {
        await decodeCheck(decodeFile);
        if (!isOwner(owner)) return;
      }
      stage = "request";
      const response = await searchAi(searchMode, body, controller.signal);
      if (!isOwner(owner)) return;
      if (response.status === 401) {
        setState({ kind: "session", message: "Phiên đăng nhập đã hết. Đăng nhập lại rồi tìm tiếp." });
        return;
      }
      if (response.status === 403) {
        setState({ kind: "forbidden", message: "Tài khoản của bạn không có quyền tìm bằng AI." });
        return;
      }
      if (!response.ok) {
        let fallback = errorMessage(response.status);
        if (response.status < 500) {
          try {
            const payload = (await response.json()) as { message?: string };
            if (payload?.message) fallback = payload.message;
          } catch {
            /* non-JSON */
          }
          if (!isOwner(owner)) return;
        }
        setState({ kind: "error", message: fallback });
        return;
      }
      stage = "json";
      const payload = await response.json();
      if (!isOwner(owner)) return;
      const hits = parseAiResults(payload);
      if (!isOwner(owner)) return;
      setState({ kind: "done", hits, label });
      // Record successful real search to per-account history (fire-and-forget).
      // Only SUCCESS is recorded here; failures/cancellations are not faked.
      const modeMap: Record<string, "TEXT" | "IMAGE" | "MULTIMODAL"> = { text: "TEXT", image: "IMAGE", multimodal: "MULTIMODAL" };
      const refs = hits.map((h) => h.maSpLienKet).filter((v): v is number => typeof v === "number").slice(0, 50);
      void recordSearchHistory({
        mode: modeMap[searchMode] ?? "TEXT",
        query: recordedQuery || undefined,
        resultCount: hits.length,
        resultRefs: JSON.stringify(refs),
        status: "SUCCESS",
      }).catch(() => { /* history recording is best-effort; never blocks search */ });
    } catch (error) {
      if (!isOwner(owner) || controller.signal.aborted) return;
      if (stage === "decode") {
        setState({ kind: "idle" });
        setFileError(error instanceof Error ? error.message : "Ảnh chưa hợp lệ.");
        return;
      }
      setState({
        kind: "error",
        message: stage === "json"
          ? "Máy chủ trả về không đúng định dạng. Thử lại sau ít phút."
          : "Không kết nối được máy chủ. Giữ nguyên đầu vào rồi thử lại.",
      });
    } finally {
      // Chỉ chủ sở hữu được mở lock; invalidation/new op không bị unlock nhầm.
      if (opRef.current === owner) {
        opRef.current = null;
        abortRef.current = null;
      }
    }
  }

  function openZoom(hit: AiHit, trigger: HTMLButtonElement, photo?: AiPhoto, mock?: boolean) {
    if (!hit.imageUrl) return;
    setViewer({
      src: hit.imageUrl,
      alt: photo?.alt ?? hit.tenHienThi ?? `Ảnh AI: ${hit.fileName}`,
      caption: mock
        ? `${hit.tenHienThi ?? hit.fileName} · Điểm thô ${hit.score.toFixed(3)}. Ảnh minh họa (mock), không phải kết quả AI thật.`
        : `${hit.tenHienThi ?? hit.fileName} · Điểm thô ${hit.score.toFixed(3)}. Ảnh từ tập dữ liệu AI, không phải sản phẩm đang bán.`,
      trigger,
    });
  }

  function closeZoom() {
    const trigger = viewer?.trigger;
    setViewer(null);
    trigger?.focus();
  }

  const busy = state.kind === "loading";
  const fieldErrorOnFile = fieldError?.target === "file";
  const fieldErrorOnQuery = fieldError?.target === "query";
  const fileDescribedBy = fieldErrorOnFile ? "ai-mode-hint ai-field-error" : "ai-mode-hint";
  const queryDescribedBy = fieldErrorOnQuery ? "ai-mode-hint ai-field-error" : "ai-mode-hint";

  function renderOutput() {
    if (state.kind === "idle") {
      return <ExamplesBoard selected={selectedExample} onPick={pickExample} />;
    }

    const heading = (
      <div className="results-head">
        <h2>Kết quả</h2>
        {state.kind === "done" && state.hits.length > 0 ? (
          <span className="result-count">{state.hits.length} kết quả</span>
        ) : null}
      </div>
    );

    if (state.kind === "loading") {
      return (
        <>
          {heading}
          <p className="search-status" role="status">Đang tìm…</p>
          <div className="results-grid" aria-hidden="true">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        </>
      );
    }

    if (state.kind === "done" && state.hits.length === 0) {
      return (
        <>
          {heading}
          <div className="empty-state">
            <h3>Không có kết quả</h3>
            <p>Thử đổi mô tả hoặc ảnh.</p>
            <button className="text-button" type="button" onClick={focusSearchField}>
              Sửa tìm kiếm
            </button>
          </div>
        </>
      );
    }

    if (state.kind === "done") {
      return (
        <>
          {heading}
          <p className="results-query">{state.label}</p>
          <div className="results-grid">
            {state.hits.map((hit) => {
              const photo = state.photos?.[hit.sourceId];
              const title = hit.tenHienThi ?? hit.fileName;
              const isSelected = selectedIds.has(hit.sourceId);
              const toggleSelect = () => setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(hit.sourceId)) next.delete(hit.sourceId); else next.add(hit.sourceId);
                return next;
              });
              return (
                <article
                  className={"result-card" + (isSelected ? " is-selected" : "")}
                  key={hit.sourceId}
                  aria-pressed={isSelected}
                  tabIndex={0}
                  onClick={toggleSelect}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSelect(); } if (e.key === "Escape") setSelectedIds(new Set()); }}
                >
                  <ResultMedia hit={hit} photo={photo} failImages={state.failImages} onZoom={(trigger) => openZoom(hit, trigger, photo, state.mock)} />
                  <div className="result-copy">
                    <h3>{title}</h3>
                    <span className="raw-score">Điểm thô <strong>{hit.score.toFixed(3)}</strong></span>
                  </div>
                  <details className="result-details">
                    <summary>Nguồn ảnh</summary>
                    <div>
                      sourceId: {hit.sourceId}
                      <br />
                      Tệp: {hit.fileName}
                      <br />
                      {hit.catalog ? <>Danh mục AI: {hit.catalog}<br /></> : null}
                      {hit.nguonDuLieu ? <>Nguồn dữ liệu: {hit.nguonDuLieu}<br /></> : null}
                      {hit.phienBanDuLieu ? <>Bản dữ liệu: {hit.phienBanDuLieu}<br /></> : null}
                      {photo ? (
                        <a className="photo-credit" href={photo.page} target="_blank" rel="noopener noreferrer">
                          Ảnh minh họa Unsplash · {photo.author}
                        </a>
                      ) : null}
                      {state.mock ? <span>Kết quả mẫu (mock), không phải AI thật.</span> : null}
                      {hit.maSpLienKet !== null && hit.maSpLienKet !== undefined && String(hit.maSpLienKet).trim() !== "" ? (
                        <>
                          <br />
                          <Link className="text-button" href={`/san-pham/${hit.maSpLienKet}`}>
                            Xem catalog liên kết →
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
          {selectedIds.size > 0 ? (
            <div className="result-selection-bar" role="status" aria-live="polite">
              <span>Đã chọn {selectedIds.size} kết quả</span>
              <button type="button" className="text-button" onClick={() => setSelectedIds(new Set())}>Bỏ chọn tất cả</button>
            </div>
          ) : null}
          <p className="result-provenance">
            {state.mock
              ? "Kết quả mẫu dùng cho kiểm tra giao diện; ảnh minh họa, không phải kết quả AI thật."
              : "Ảnh tham khảo từ tập dữ liệu AI, chưa gắn sản phẩm đang bán. Điểm thô không phải xác suất."}
          </p>
        </>
      );
    }

    if (state.kind === "error") {
      return (
        <>
          {heading}
          <div ref={errorRef} className="status error" role="alert" tabIndex={-1}>{state.message}</div>
          <div className="state-actions">
            {!isPreview ? (
              <button className="text-button" type="button" onClick={() => run()}>Thử lại (giữ đầu vào)</button>
            ) : null}
            <button className="text-button" type="button" onClick={focusSearchField}>
              Sửa tìm kiếm
            </button>
          </div>
        </>
      );
    }

    if (state.kind === "session") {
      return (
        <>
          {heading}
          <div ref={errorRef} className="status error" role="alert" tabIndex={-1}>{state.message}</div>
          <div className="state-actions">
            <Link className="text-button" href="/dang-nhap?next=/tim-kiem-ai">Đăng nhập →</Link>
            <button className="text-button" type="button" onClick={focusSearchField}>
              Sửa tìm kiếm
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        {heading}
        <div ref={errorRef} className="status error" role="alert" tabIndex={-1}>{state.message}</div>
        <div className="state-actions">
          <Link className="text-button" href="/tai-khoan">Tài khoản của tôi →</Link>
          <button className="text-button" type="button" onClick={focusSearchField}>
            Sửa tìm kiếm
          </button>
        </div>
      </>
    );
  }

  return (
    <StorefrontShell active="/tim-kiem-ai" themed palette="customer" header="customer">
      <div className="aiPage">
        <div className="ai-shell">
          <section className="ai-input" aria-labelledby="search-title">
            <span className="ai-motif" aria-hidden="true">
              <svg viewBox="0 0 48 48" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4H32" />
                <path d="M32 4H44" strokeDasharray="6 5" />
                <path d="M44 4V44" />
              </svg>
            </span>
            <h1 id="search-title">Tìm đồ</h1>
            <form className="search-form" onSubmit={run} aria-label="Tìm bằng AI">
              <div className="mode-switch" role="group" aria-label="Cách tìm kiếm">
                {(["text", "image", "composed"] as AiMode[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={mode === item}
                    onClick={() => {
                      invalidatePending();
                      setMode(item);
                      setFieldError(null);
                      setState({ kind: "idle" });
                    }}
                  >
                    {item === "text" ? "Chữ" : item === "image" ? "Ảnh" : "Kết hợp"}
                  </button>
                ))}
              </div>
              <p className="mode-hint" id="ai-mode-hint">{AI_MODE_HINTS[mode]}</p>

              {mode !== "image" ? (
                <div className="field query-field">
                  <label htmlFor="ai-query">Mô tả</label>
                  <textarea
                    ref={queryRef}
                    className="textarea"
                    id="ai-query"
                    name="q"
                    value={query}
                    onChange={(event) => {
                      invalidatePending();
                      setQuery(event.target.value);
                      if (fieldErrorOnQuery) setFieldError(null);
                    }}
                    maxLength={200}
                    placeholder="black jacket, oversized fit…"
                    aria-invalid={fieldErrorOnQuery || undefined}
                    aria-describedby={queryDescribedBy}
                  />
                </div>
              ) : null}

              {mode !== "text" ? (
                <div className="field upload-field">
                  <span className="field-label" id="ai-image-label">Ảnh tham chiếu</span>
                  <input
                    ref={fileInputRef}
                    className="ai-sr-only"
                    id="ai-file"
                    name="file"
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(event) => onFile(event.target.files)}
                    aria-labelledby="ai-image-label"
                    aria-invalid={fieldErrorOnFile || undefined}
                    aria-describedby={fileDescribedBy}
                  />
                  {file && previewUrl ? (
                    <div className="reference-compact">
                      {previewFailed ? (
                        <span className="reference-thumb reference-thumb-fail" role="img" aria-label={`Không tải được ảnh: ${file.name}`}>
                          Không tải được ảnh
                        </span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- object URL preview
                        <img
                          className="reference-thumb"
                          src={previewUrl}
                          alt={`Ảnh tham chiếu đã chọn: ${file.name}`}
                          onError={() => setPreviewFailed(true)}
                        />
                      )}
                      <span className="reference-meta">
                        <span className="file-name">{file.name}</span>
                        <span className="reference-hint">Ảnh tham chiếu</span>
                      </span>
                      <span className="reference-actions">
                        <button className="mini-button" type="button" onClick={() => fileInputRef.current?.click()}>
                          Thay ảnh
                        </button>
                        <button className="mini-button" type="button" aria-label="Xóa ảnh tham chiếu" onClick={removeFile}>
                          Xóa
                        </button>
                      </span>
                    </div>
                  ) : (
                    <label className="upload-select" htmlFor="ai-file">
                      <AiUploadIcon />
                      <span>Chọn ảnh</span>
                    </label>
                  )}
                  <p className="panel-note">JPEG/PNG · ≤{Math.round(AI_MAX_BYTES / 1024 / 1024)}MiB · ≤4000px.</p>
                </div>
              ) : null}

              {fieldError ? (
                <p className="panel-error" id="ai-field-error" role="alert">{fieldError.message}</p>
              ) : null}

              <button
                className="search-submit"
                type="submit"
                disabled={busy || checking || isPreview}
                aria-describedby={isPreview ? "ai-preview-limit" : undefined}
              >
                <AiSearchIcon />
                {busy ? "Đang tìm…" : "Tìm kiếm"}
              </button>

              {isPreview ? (
                <p className="panel-note" id="ai-preview-limit">Dạng xem thử: nút tìm kiếm không gửi AI thật.</p>
              ) : !checking && !me ? (
                <p className="panel-note">
                  Cần đăng nhập để tìm bằng AI.{" "}
                  <Link className="panel-link" href="/dang-nhap?next=/tim-kiem-ai">Đăng nhập →</Link>
                </p>
              ) : null}
            </form>
          </section>

          <section className="ai-output" aria-label="Kết quả tìm kiếm" aria-busy={busy} ref={outputRef} tabIndex={-1}>
            {preview ? (
              <p className="preview-note" role="note">
                Dạng xem thử (mock) — không gọi AI thật · ?preview={preview}
              </p>
            ) : null}
            {checking ? <p className="search-status" role="status">Đang kiểm tra phiên đăng nhập…</p> : renderOutput()}
          </section>
        </div>
        <AiImageDialog viewer={viewer} onClose={closeZoom} />
      </div>
    </StorefrontShell>
  );
}
