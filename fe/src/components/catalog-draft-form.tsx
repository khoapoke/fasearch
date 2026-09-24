"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AuthPanel } from "@/components/auth-panel";
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

export function CatalogDraftForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const imageInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("TOP");
  const [loading, setLoading] = useState(Boolean(productId));
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!productId) return;
    let active = true;
    fetch(`/api/catalog/drafts/${encodeURIComponent(productId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể đọc sản phẩm nháp. Hãy đăng nhập bằng tài khoản có quyền.");
        const value = (await response.json()) as Draft;
        if (!active) return;
        setDraft(value);
        setTitle(value.title);
        setDescription(value.description ?? "");
        setCategory(value.category);
      })
      .catch((failure) => {
        if (active) setError(failure instanceof Error ? failure.message : "Không thể tải sản phẩm nháp.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { cache: "no-store" });
      if (!csrfResponse.ok) throw new Error("Không thể xác nhận phiên. Hãy đăng nhập lại.");
      const csrf = (await csrfResponse.json()) as { header_name: string; token: string };
      const response = await fetch(
        draft ? `/api/catalog/drafts/${draft.product_id}` : "/api/catalog/drafts",
        {
          method: draft ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
            [csrf.header_name]: csrf.token,
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            category,
            ...(draft ? { expected_version_no: draft.version_no } : {}),
          }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json()) as { code?: string };
        if (payload.code === "VERSION_CONFLICT") {
          throw new Error("Sản phẩm đã được thay đổi. Tải lại trang trước khi sửa tiếp.");
        }
        throw new Error(response.status === 403
          ? "Tài khoản này không có quyền sửa sản phẩm nháp."
          : "Không thể lưu sản phẩm nháp. Kiểm tra dữ liệu và thử lại.");
      }
      const saved = (await response.json()) as Draft;
      setDraft(saved);
      setMessage(`Đã lưu Product Version ${saved.version_no}.`);
      if (!draft) router.replace(`/catalog/drafts/${saved.product_id}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể lưu sản phẩm nháp.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage() {
    if (!draft || !imageFile) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { cache: "no-store" });
      if (!csrfResponse.ok) throw new Error("Không thể xác nhận phiên. Hãy đăng nhập lại.");
      const csrf = (await csrfResponse.json()) as { header_name: string; token: string };
      const body = new FormData();
      body.set("image", imageFile);
      body.set("expected_version_no", String(draft.version_no));
      const response = await fetch(`/api/catalog/drafts/${draft.product_id}/image`, {
        method: "POST",
        headers: { [csrf.header_name]: csrf.token },
        body,
      });
      if (!response.ok) {
        const payload = (await response.json()) as { code?: string };
        if (payload.code === "VERSION_CONFLICT") {
          throw new Error("Sản phẩm đã được thay đổi. Tải lại trang trước khi thêm ảnh.");
        }
        throw new Error(payload.code === "IMAGE_TOO_LARGE"
          ? "Ảnh vượt quá giới hạn 10 MiB."
          : payload.code === "INVALID_IMAGE"
            ? "Chỉ nhận ảnh JPEG, PNG hoặc WebP hợp lệ."
            : "Không thể tải ảnh lên. Hãy kiểm tra quyền và thử lại.");
      }
      const updated = (await response.json()) as Draft;
      setDraft(updated);
      setImageFile(null);
      if (imageInput.current) imageInput.current.value = "";
      setMessage(`Đã lưu ảnh chính ở phiên bản ${updated.version_no}.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tải ảnh lên.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">FaSearch</Link>
        <AuthPanel />
      </header>
      <div className={styles.intro}>
        <div>
          <p className={styles.kicker}>Catalog workspace</p>
          <h1>{draft ? "Chỉnh sửa sản phẩm nháp" : "Thêm sản phẩm vào catalog"}</h1>
          <p>
            Mỗi lần sửa tên, mô tả hoặc ảnh, hệ thống lưu một phiên bản mới. Sản phẩm
            chỉ xuất hiện trong kết quả sau khi được xử lý và công bố.
          </p>
        </div>
        <div className={styles.versionBox}>
          <span>Trạng thái hiện tại</span>
          <strong>{draft?.status ?? "Chưa tạo"}</strong>
          {draft && <small>Version {draft.version_no}</small>}
        </div>
      </div>

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
            />
          </label>
          <label>
            Danh mục
            <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
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
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Kiểu dáng, chất liệu và chi tiết nhận diện"
            />
          </label>
          <button className={styles.save} type="submit" disabled={saving || loading}>
            {saving ? "Đang lưu" : draft ? "Lưu phiên bản mới" : "Tạo sản phẩm nháp"}
          </button>
          {draft && (
            <section className={styles.imageSection} aria-label="Ảnh chính của sản phẩm">
              <div>
                <h2>Ảnh chính</h2>
                <p>Chọn JPEG, PNG hoặc WebP tối đa 10 MiB. Thay ảnh sẽ lưu một phiên bản mới.</p>
              </div>
              {draft.has_primary_image && (
                <div className={styles.imagePreview}>
                  <Image
                    src={`/api/catalog/drafts/${draft.product_id}/image?v=${draft.version_no}`}
                    alt={`Ảnh chính của ${draft.title}`}
                    fill
                    unoptimized
                    sizes="(max-width: 700px) 90vw, 480px"
                  />
                </div>
              )}
              <input
                ref={imageInput}
                aria-label="Chọn ảnh sản phẩm"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  if (selected && selected.size > 10 * 1024 * 1024) {
                    setError("Ảnh vượt quá giới hạn 10 MiB.");
                    event.target.value = "";
                    setImageFile(null);
                  } else {
                    setError("");
                    setImageFile(selected);
                  }
                }}
              />
              <button className={styles.upload} type="button"
                disabled={!imageFile || uploading || saving} onClick={uploadImage}>
                {uploading ? "Đang tải ảnh" : draft.has_primary_image ? "Thay ảnh chính" : "Thêm ảnh chính"}
              </button>
              <small>Lưu thay đổi tên/mô tả trước khi thêm ảnh để chúng cùng thuộc version mới nhất.</small>
            </section>
          )}
          {message && <p className={styles.success} role="status">{message}</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
        </form>
        <aside className={styles.sideNote}>
          <h2>Tiếp theo trong luồng</h2>
          <ol>
            <li>Thêm ảnh chính cho sản phẩm.</li>
            <li>Tạo embedding cho Product Version đang chờ.</li>
            <li>Administrator duyệt và công bố catalog.</li>
          </ol>
          <p>Upload ảnh đã mở; quality check, embedding và publication vẫn là checkpoint kế tiếp.</p>
        </aside>
      </section>
      {draft && (
        <p className={styles.identifiers}>
          Product ID: {draft.product_id}<br />
          Product Version ID: {draft.product_version_id}
        </p>
      )}
    </main>
  );
}
