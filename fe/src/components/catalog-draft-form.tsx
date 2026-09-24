"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
};

export function CatalogDraftForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("TOP");
  const [loading, setLoading] = useState(Boolean(productId));
  const [saving, setSaving] = useState(false);
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
            Mỗi lần sửa nội dung tìm kiếm tạo một Product Version mới. Sản phẩm
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
          {message && <p className={styles.success} role="status">{message}</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
        </form>
        <aside className={styles.sideNote}>
          <h2>Tiếp theo trong luồng</h2>
          <ol>
            <li>Thêm ảnh và kiểm tra metadata.</li>
            <li>Tạo embedding cho Product Version đang chờ.</li>
            <li>Administrator duyệt và công bố catalog.</li>
          </ol>
          <p>Ba bước này chưa được mở trong checkpoint Draft hiện tại.</p>
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
