"use client";

import { useState } from "react";
import { importUrl, CatalogAdminError } from "@/lib/admin-catalog-client";

/**
 * Nhập URL có hỗ trợ (tùy chọn): BE kiểm tra allowlist/redirect/IP/kích thước và
 * ánh xạ ID nguồn/variant/provenance chính xác. Lỗi fetch giữ nguyên form thủ công;
 * thành công hiển thị draftId + trường đã ánh xạ, không tự điền form để tránh
 * ghi đè dữ liệu người dùng đã nhập.
 */
export function UrlAssist() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ draftId: number; name?: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !url.trim()) return;
    setBusy(true);
    setError("");
    setDone(null);
    try {
      const result = await importUrl(url.trim());
      setDone({ draftId: result.draftId });
      setUrl("");
    } catch (failure) {
      if (failure instanceof CatalogAdminError && failure.status === 422) {
        setError("URL không ánh xạ được thành sản phẩm (thiếu ảnh/biến thể). Form thủ công bên dưới giữ nguyên.");
        return;
      }
      setError(failure instanceof Error ? failure.message : "Không nhập được URL.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workbench" aria-label="Nhập từ URL (tùy chọn)" style={{ marginBottom: 18 }}>
      <div className="section-head">
        <div>
          <h2>Nhập từ URL</h2>
          <p className="meta">Chỉ nguồn trong allowlist (feed VN đã kiểm chứng, Wikimedia, tên miền hãng đã duyệt). Không proxy tùy ý.</p>
        </div>
      </div>
      <form onSubmit={submit}>
        <div className="catalog-field">
          <label htmlFor="url-assist">URL sản phẩm</label>
          <input
            id="url-assist"
            className="catalog-input"
            type="url"
            value={url}
            maxLength={2048}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="catalog-actions">
          <button className="primary" type="submit" disabled={busy || !url.trim()} aria-disabled={busy || !url.trim()}>
            {busy ? "Đang nhập…" : "Nhập thành bản nháp"}
          </button>
        </div>
      </form>
      {error ? (
        <p className="catalog-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="meta" role="status" style={{ marginTop: 10 }}>
          Đã tạo bản nháp <strong>#{done.draftId}</strong> ở máy chủ. Form thủ công bên dưới không bị thay đổi.
        </p>
      ) : null}
    </section>
  );
}
