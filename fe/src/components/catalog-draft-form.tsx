"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AuthPanel } from "@/components/auth-panel";
import { CatalogVersionHistory } from "@/components/catalog-version-history";
import { CatalogAuditTrail } from "@/components/catalog-audit-trail";
import styles from "./catalog-draft-form.module.css";

type Category = "TOP" | "BOTTOM" | "ONE_PIECE";
type Draft = {
  product_id: string;
  product_version_id: string;
  version_no: number;
  status: string;
  title: string;
  description: string | null;
  category: Category;
  has_primary_image: boolean;
};

type Conflict = {
  kind: "metadata" | "image";
  server: Draft;
};

export function CatalogDraftForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const backHref = searchParams.get("from") ?? "/catalog/drafts";
  const imageInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef<AbortController | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("TOP");
  const [loading, setLoading] = useState(Boolean(productId));
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [conflict, setConflict] = useState<Conflict | null>(null);

  const dirty =
    draft != null &&
    (title !== draft.title ||
      description !== (draft.description ?? "") ||
      category !== draft.category);

  useEffect(() => {
    if (!dirty && !imageFile) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, imageFile]);

  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    inFlight.current = controller;
    fetch(`/api/catalog/drafts/${encodeURIComponent(productId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
        }
        if (response.status === 403) {
          throw new Error("Tài khoản này không có quyền sửa sản phẩm nháp này.");
        }
        if (response.status === 404) {
          throw new Error("Sản phẩm nháp không tồn tại.");
        }
        if (!response.ok) throw new Error("Không thể đọc sản phẩm nháp. Hãy thử lại.");
        const value = (await response.json()) as Draft;
        setDraft(value);
        setTitle(value.title);
        setDescription(value.description ?? "");
        setCategory(value.category);
      })
      .catch((failure) => {
        if (failure instanceof DOMException && failure.name === "AbortError") return;
        setError(failure instanceof Error ? failure.message : "Không thể tải sản phẩm nháp.");
      })
      .finally(() => {
        setLoading(false);
      });
    return () => controller.abort();
  }, [productId]);

  const previewUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      inFlight.current?.abort();
      if (previewUrl.current) {
        URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = null;
      }
    },
    [],
  );

  function selectImageFile(selectedFile: File | null) {
    if (previewUrl.current) {
      URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = null;
    }
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      previewUrl.current = url;
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
    setImageFile(selectedFile);
  }

  async function csrfHeaders(extra?: Record<string, string>) {
    const csrfResponse = await fetch("/api/auth/csrf", { cache: "no-store" });
    if (!csrfResponse.ok) throw new Error("Không thể xác nhận phiên. Hãy đăng nhập lại.");
    const csrf = (await csrfResponse.json()) as { header_name: string; token: string };
    return { [csrf.header_name]: csrf.token, ...extra };
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || uploading) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setFieldError("Hãy nhập tên sản phẩm (tối đa 250 ký tự).");
      return;
    }
    if (trimmed.length > 250) {
      setFieldError("Tên sản phẩm quá dài (tối đa 250 ký tự).");
      return;
    }
    if (description.length > 4000) {
      setFieldError("Mô tả quá dài (tối đa 4000 ký tự).");
      return;
    }
    setFieldError("");
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const expected = conflict?.kind === "metadata" ? conflict.server.version_no : draft?.version_no;
      const response = await fetch(
        draft ? `/api/catalog/drafts/${draft.product_id}` : "/api/catalog/drafts",
        {
          method: draft ? "PATCH" : "POST",
          headers: await csrfHeaders({ "content-type": "application/json" }),
          signal: controller.signal,
          body: JSON.stringify({
            title: trimmed,
            description: description.trim() || null,
            category,
            ...(draft ? { expected_version_no: expected } : {}),
          }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { code?: string };
        if (response.status === 409 || payload.code === "VERSION_CONFLICT") {
          await enterConflict("metadata");
          return;
        }
        if (response.status === 401) throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
        throw new Error(
          response.status === 403
            ? "Tài khoản này không có quyền sửa sản phẩm nháp."
            : "Không thể lưu sản phẩm nháp. Kiểm tra dữ liệu và thử lại.",
        );
      }
      const saved = (await response.json()) as Draft;
      setDraft(saved);
      setConflict(null);
      setMessage(`Đã lưu bản ${saved.version_no}.`);
      if (!draft) router.replace(`/catalog/drafts/${saved.product_id}`);
    } catch (failure) {
      if (failure instanceof DOMException && failure.name === "AbortError") return;
      setError(failure instanceof Error ? failure.message : "Không thể lưu sản phẩm nháp.");
    } finally {
      setSaving(false);
    }
  }

  async function enterConflict(kind: "metadata" | "image") {
    if (!draft) return;
    setError("");
    try {
      const response = await fetch(`/api/catalog/drafts/${draft.product_id}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Không thể tải bản mới nhất từ máy chủ.");
      const server = (await response.json()) as Draft;
      setDraft(server);
      setConflict({ kind, server });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? `Sản phẩm đã được thay đổi ở nơi khác nhưng chưa tải được bản mới: ${failure.message}`
          : "Sản phẩm đã được thay đổi ở nơi khác. Hãy tải lại trang.",
      );
    }
  }

  async function uploadImage() {
    if (!draft || !imageFile || uploading || saving) return;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const expected = conflict?.kind === "image" ? conflict.server.version_no : draft.version_no;
      const body = new FormData();
      body.set("image", imageFile);
      body.set("expected_version_no", String(expected));
      const response = await fetch(`/api/catalog/drafts/${draft.product_id}/image`, {
        method: "POST",
        headers: await csrfHeaders(),
        signal: controller.signal,
        body,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { code?: string };
        if (response.status === 409 || payload.code === "VERSION_CONFLICT") {
          await enterConflict("image");
          return;
        }
        throw new Error(
          payload.code === "IMAGE_TOO_LARGE"
            ? "Ảnh vượt quá giới hạn 10 MiB."
            : payload.code === "INVALID_IMAGE"
              ? "Chỉ nhận ảnh JPEG, PNG hoặc WebP hợp lệ."
              : response.status === 503
                ? "Kho ảnh đang bận. Ảnh của bạn vẫn được giữ; hãy thử lại."
                : "Không thể tải ảnh lên. Hãy kiểm tra quyền và thử lại.",
        );
      }
      const updated = (await response.json()) as Draft;
      setDraft(updated);
      selectImageFile(null);
      if (imageInput.current) imageInput.current.value = "";
      setConflict(null);
      setMessage(`Đã lưu ảnh chính ở bản ${updated.version_no}.`);
    } catch (failure) {
      if (failure instanceof DOMException && failure.name === "AbortError") return;
      setError(failure instanceof Error ? failure.message : "Không thể tải ảnh lên.");
    } finally {
      setUploading(false);
    }
  }

  function discardConflictKeepEditing() {
    // Keep local text and selected file; user continues from their own draft.
    setConflict(null);
    setMessage("Đã giữ lại nội dung bạn đang sửa. Hãy xem lại rồi lưu khi sẵn sàng.");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          FaSearch
        </Link>
        <AuthPanel />
      </header>
      <p className={styles.back}>
        <Link href={backHref}>← Về danh sách nháp</Link>
      </p>
      <div className={styles.intro}>
        <div>
          <p className={styles.kicker}>Catalog workspace</p>
          <h1>{draft ? "Chỉnh sửa sản phẩm nháp" : "Thêm sản phẩm vào catalog"}</h1>
          <p>
            Mỗi lần sửa tên, mô tả hoặc ảnh, hệ thống lưu một phiên bản mới.
            Sản phẩm chỉ xuất hiện trong kết quả sau khi được xử lý và công bố.
          </p>
        </div>
        <div className={styles.versionBox}>
          <span>Trạng thái hiện tại</span>
          <strong>{draft?.status ?? "Chưa tạo"}</strong>
          {draft && <small>Bản {draft.version_no}</small>}
          {dirty && (
            <small className={styles.dirty} role="status">
              Có thay đổi chưa lưu
            </small>
          )}
          {saving || uploading ? (
            <small role="status">Đang lưu…</small>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p role="status">Đang tải sản phẩm nháp…</p>
      ) : (
        <section className={styles.workspace} aria-label="Nội dung sản phẩm nháp">
          <form className={styles.form} onSubmit={save}>
            <label>
              Tên sản phẩm
              <input
                required
                maxLength={250}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ví dụ: Áo sơ mi linen màu xanh"
                aria-invalid={fieldError !== ""}
                aria-describedby={fieldError ? "draft-field-error" : undefined}
              />
            </label>
            <label>
              Danh mục
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as Category)}
              >
                <option value="TOP">Áo</option>
                <option value="BOTTOM">Quần / váy rời</option>
                <option value="ONE_PIECE">Trang phục liền</option>
              </select>
            </label>
            <label>
              Mô tả
              <textarea
                rows={5}
                value={description}
                maxLength={4000}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Kiểu dáng, chất liệu và chi tiết nhận diện"
              />
            </label>
            {fieldError && (
              <p id="draft-field-error" className={styles.error} role="alert">
                {fieldError}
              </p>
            )}
            <button className={styles.save} type="submit" disabled={saving || uploading || loading}>
              {saving ? "Đang lưu…" : draft ? "Lưu phiên bản mới" : "Tạo sản phẩm nháp"}
            </button>
            {conflict?.kind === "metadata" && (
              <div className={styles.conflict} role="alert">
                <h2>Đã có bản mới hơn trên máy chủ</h2>
                <p>
                  Nội dung bạn đang sửa được giữ nguyên. Máy chủ đang ở bản{" "}
                  {conflict.server.version_no} — hãy so sánh rồi quyết định lưu tiếp.
                </p>
                <table className={styles.compareTable}>
                  <caption>So sánh nội dung của bạn với bản mới nhất</caption>
                  <thead>
                    <tr>
                      <th scope="col">Trường</th>
                      <th scope="col">Bản của bạn (chưa lưu)</th>
                      <th scope="col">Bản {conflict.server.version_no} (máy chủ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Tên</th>
                      <td>{title}</td>
                      <td>{conflict.server.title}</td>
                    </tr>
                    <tr>
                      <th scope="row">Mô tả</th>
                      <td>{description || "—"}</td>
                      <td>{conflict.server.description || "—"}</td>
                    </tr>
                  </tbody>
                </table>
                <div className={styles.conflictActions}>
                  <button type="submit" disabled={saving || uploading}>
                    {saving ? "Đang lưu…" : `Lưu nội dung của tôi lên bản ${conflict.server.version_no}`}
                  </button>
                  <button type="button" onClick={discardConflictKeepEditing}>
                    Giữ lại để xem thêm
                  </button>
                </div>
              </div>
            )}
            {draft && (
              <section className={styles.imageSection} aria-label="Ảnh chính của sản phẩm">
                <div>
                  <h2>Ảnh chính</h2>
                  <p>
                    Chọn JPEG, PNG hoặc WebP tối đa 10 MiB. Thay ảnh sẽ lưu một
                    phiên bản mới.
                  </p>
                </div>
                {imagePreview ? (
                  <div className={styles.imagePreview}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Ảnh bạn vừa chọn" />
                  </div>
                ) : (
                  draft.has_primary_image && (
                    <div className={styles.imagePreview}>
                      <Image
                        src={`/api/catalog/drafts/${draft.product_id}/image?v=${draft.version_no}`}
                        alt={`Ảnh chính của ${draft.title}`}
                        fill
                        unoptimized
                        sizes="(max-width: 700px) 90vw, 480px"
                      />
                    </div>
                  )
                )}
                <input
                  ref={imageInput}
                  aria-label="Chọn ảnh sản phẩm"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] ?? null;
                    if (selectedFile && selectedFile.size > 10 * 1024 * 1024) {
                      setError("Ảnh vượt quá giới hạn 10 MiB.");
                      event.target.value = "";
                      selectImageFile(null);
                    } else {
                      setError("");
                      selectImageFile(selectedFile);
                    }
                  }}
                />
                {imageFile && (
                  <p className={styles.fileInfo} role="status">
                    Đã chọn: {imageFile.name} (
                    {Math.max(1, Math.round(imageFile.size / 1024))} KB). Ảnh cũ vẫn
                    được giữ cho đến khi tải lên thành công.
                  </p>
                )}
                <button
                  className={styles.upload}
                  type="button"
                  disabled={!imageFile || uploading || saving}
                  onClick={uploadImage}
                >
                  {uploading
                    ? "Đang tải ảnh…"
                    : draft.has_primary_image
                      ? "Thay ảnh chính"
                      : "Thêm ảnh chính"}
                </button>
                {conflict?.kind === "image" && (
                  <div className={styles.conflict} role="alert">
                    <h2>Ảnh chưa được lưu vì đã có bản mới</h2>
                    <p>
                      Tệp bạn đã chọn vẫn được giữ. Máy chủ đang ở bản{" "}
                      {conflict.server.version_no}. Nhấn tải lên lại để lưu ảnh
                      cùng bản mới nhất.
                    </p>
                    <div className={styles.conflictActions}>
                      <button
                        type="button"
                        onClick={uploadImage}
                        disabled={!imageFile || uploading || saving}
                      >
                        {uploading ? "Đang tải ảnh…" : "Tải ảnh lên lại"}
                      </button>
                      <button type="button" onClick={discardConflictKeepEditing}>
                        Để sau
                      </button>
                    </div>
                  </div>
                )}
                <small>
                  Lưu thay đổi tên/mô tả trước khi thêm ảnh để chúng cùng thuộc
                  version mới nhất.
                </small>
              </section>
            )}
            {message && (
              <p className={styles.success} role="status">
                {message}
              </p>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </form>
          <aside className={styles.sideNote}>
            <h2>Tiếp theo trong luồng</h2>
            <ol>
              <li>Thêm ảnh chính cho sản phẩm.</li>
              <li>Tạo embedding cho Product Version đang chờ.</li>
              <li>Administrator duyệt và công bố catalog.</li>
            </ol>
            <p>
              Upload ảnh đã mở; quality check, embedding và publication vẫn là
              checkpoint kế tiếp.
            </p>
          </aside>
        </section>
      )}
      {draft && (
        <>
          <p className={styles.identifiers}>
            Product ID: {draft.product_id}
            <br />
            Product Version ID: {draft.product_version_id}
          </p>
          <div className={styles.history}>
            <CatalogVersionHistory productId={draft.product_id} currentVersion={draft.version_no} />
          </div>
          <div className={styles.history}>
            <CatalogAuditTrail productId={draft.product_id} currentVersion={draft.version_no} />
          </div>
        </>
      )}
    </main>
  );
}
