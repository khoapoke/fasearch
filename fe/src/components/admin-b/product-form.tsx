"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImageDrop, imageSrc } from "./image-drop";
import { InfoHint } from "./info-hint";
import { MoneyInput } from "./money-input";
import { StatusBadge } from "./status-badge";
import { useToast } from "./toast";
import { formatNumber } from "@/lib/admin-format";
import { MONEY_INVALID } from "@/lib/money-input";
import {
  CatalogAdminError,
  createDraft,
  listDrafts,
  updateDraft,
  uploadDraftImage,
  type Category,
  type Product,
} from "@/lib/admin-catalog-client";

/**
 * Biểu mẫu metadata theo luồng bản nháp của hợp đồng BE v1.
 *
 * - Tạo mới: POST /admin/products/drafts → sản phẩm ở trạng thái DRAFT, chưa
 *   xuất bản; người dùng xuất bản ở trang chi tiết.
 * - Sửa: tìm bản nháp đang mở của sản phẩm; chưa có thì mở bản nháp liên kết
 *   tới productId hiện tại (BE xác thực). Lưu bằng PUT kèm expectedVersion và
 *   hiển thị lỗi 409 rõ ràng — không ghi đè nội dung đã xuất bản.
 * - Trạng thái xuất bản KHÔNG đặt qua form; chỉ publish/unpublish ở trang chi tiết.
 */

const IMAGE_TYPES = ["image/png", "image/jpeg"];
const STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", ACTIVE: "Đang bán", OUT_OF_STOCK: "Tạm hết hàng", DISCONTINUED: "Ngừng kinh doanh" };
const PUBLICATION_LABEL: Record<string, { label: string; tone: "green" | "gray" | "orange" }> = {
  PUBLISHED: { label: "Đã Publish", tone: "green" },
  DRAFT: { label: "Chưa Publish", tone: "gray" },
  UNPUBLISHED: { label: "Đã Unpublish", tone: "orange" },
};
const NAMES: Record<string, string> = { productName: "productName", categoryId: "categoryId", price: "price", material: "material", style: "style", description: "description", imageUrl: "imageUrl" };

export function ProductForm({ mode, product, categories }: { mode: "create" | "edit"; product?: Product; categories: Category[] }) {
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo(() => ({
    productName: product?.productName ?? "",
    categoryId: String(product?.categoryId ?? categories[0]?.id ?? ""),
    material: product?.material ?? "",
    style: product?.style ?? "",
    description: product?.description ?? "",
    price: product ? String(product.price) : "",
    imageUrl: product?.imageUrl ?? "",
  }), [product, categories]);
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [conflict, setConflict] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [imageNote, setImageNote] = useState("");
  const imageInput = useRef<HTMLInputElement | null>(null);
  const descRef = useRef<HTMLTextAreaElement | null>(null);

  const dirty = pending !== null || (Object.keys(initial) as Array<keyof typeof initial>).some((k) => values[k] !== initial[k]);

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  // Description grows with its text up to 12 lines, then scrolls.
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 12 * 22 + 16)}px`;
  }, [values.description]);

  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url); }, [pending]);

  function set(key: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => { const next = { ...e }; delete next[key]; return next; });
  }

  function fields() {
    return {
      productName: values.productName.trim(),
      categoryId: Number(values.categoryId),
      material: values.material.trim(),
      style: values.style.trim(),
      description: values.description,
      price: Number(values.price),
      imageUrl: values.imageUrl.trim(),
    };
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!values.productName.trim()) next.productName = "Nhập tên sản phẩm.";
    if (!values.categoryId) next.categoryId = "Chọn danh mục.";
    if (values.price === "" || !Number.isFinite(Number(values.price)) || Number(values.price) < 0) next.price = values.price === MONEY_INVALID ? "Giá chưa đúng định dạng. Nhập số như 1.450.000 hoặc 1450000,5." : "Nhập giá bán (số không âm).";
    return next;
  }

  function showErrors(next: Record<string, string>) {
    setErrors(next);
    const first = Object.keys(next).find((k) => NAMES[k]);
    if (first) window.setTimeout(() => document.getElementById(`pf-${first}`)?.focus(), 0);
  }

  async function pickFile(file: File) {
    setImageNote("");
    if (mode === "create" || !product) {
      setPending({ file, url: URL.createObjectURL(file) });
      set("imageUrl", "");
      setUrlOpen(false);
      return;
    }
    if (busy || uploading) return;
    setUploading(true);
    try {
      const drafts = await listDrafts("page=0&size=50");
      let draft = drafts.find((d) => d.productId === product.id);
      if (!draft) draft = await createDraft({ ...fields(), productId: product.id });
      const result = await uploadDraftImage(draft.draftId, file);
      if (result.imageUrl) { set("imageUrl", result.imageUrl); setImageNote("Đã tải ảnh vào Draft."); }
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Không tải được ảnh.";
      setImageNote(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || uploading) return;
    const found = validate();
    if (Object.keys(found).length) { showErrors(found); toast.error("Kiểm tra lại các ô được đánh dấu."); return; }
    setBusy(true); setErrors({}); setConflict("");
    try {
      if (mode === "create") {
        const draft = await createDraft(fields());
        // Bản nháp mới KHÔNG có productId cho tới khi xuất bản — không bao giờ
        // dùng draftId như productId (đó là hai không gian ID khác nhau).
        if (pending) {
          try { await uploadDraftImage(draft.draftId, pending.file); }
          catch (failure) { toast.error(`Đã lưu Draft nhưng chưa tải được ảnh: ${failure instanceof Error ? failure.message : "lỗi không rõ"}`); }
        }
        toast.success("Đã lưu Draft.");
        router.replace(`/quan-tri/san-pham/nhap/${draft.draftId}`);
        return; // stay busy: the page is navigating away
      }
      const id = String(product?.id ?? "");
      const drafts = await listDrafts("page=0&size=50");
      let draft = drafts.find((d) => d.productId === product?.id);
      if (!draft) {
        // BE contract: mở bản nháp sửa phải nhận productId thật (đã nêu trong
        // live/fe/READY.json). Không tạo sản phẩm mới.
        draft = await createDraft({ ...fields(), productId: product?.id });
      }
      await updateDraft(draft.draftId, { ...fields(), expectedVersion: draft.version });
      toast.success("Đã lưu vào Draft.");
      router.replace(`/quan-tri/san-pham/${id}`);
      return; // stay busy: the page is navigating away
    } catch (failure) {
      if (failure instanceof CatalogAdminError && failure.status === 409) {
        const message = "Draft đã thay đổi ở phiên khác. Mở trang chi tiết để tải Draft mới rồi lưu lại; nội dung đang bán không bị ghi đè.";
        setConflict(message);
        toast.error(message);
        setBusy(false);
        return;
      }
      const message = failure instanceof Error ? failure.message : "Không lưu được Draft.";
      const list = (failure as { errors?: Array<{ field?: string; reason?: string }> }).errors;
      const next: Record<string, string> = {};
      for (const item of list ?? []) if (item.field && NAMES[item.field] && !next[item.field]) next[item.field] = item.reason || message;
      toast.error(message);
      if (Object.keys(next).length) showErrors(next);
      else setConflict(message);
      setBusy(false);
    }
  }

  const preview = pending?.url ?? imageSrc(values.imageUrl.trim() || null);
  const publication = product?.publicationStatus ? PUBLICATION_LABEL[product.publicationStatus] : undefined;
  const sellable = product ? product.status === "ACTIVE" || product.status === "OUT_OF_STOCK" : false;
  const statusKey = product ? (sellable && product.publicationStatus === "UNPUBLISHED" ? "UNPUBLISHED" : sellable && product.publicationStatus === "DRAFT" ? "DRAFT" : product.status) : "DRAFT";
  const statusLabel = product ? (sellable && product.publicationStatus === "UNPUBLISHED" ? "Đã Unpublish" : sellable && product.publicationStatus === "DRAFT" ? "Chưa Publish" : STATUS_LABEL[product.status] ?? product.status) : "Draft mới";
  const err = (key: string) => errors[key] ? <p className="field-error" id={`pf-${key}-err`} role="alert">{errors[key]}</p> : null;
  const invalid = (key: string) => errors[key] ? { "aria-invalid": true as const, "aria-describedby": `pf-${key}-err` } : {};

  return (
    <form className="catalog-form pf-form" onSubmit={submit} noValidate aria-busy={busy}>
      <div className="form-layout">
        <div className="form-main">
          <section className="form-card" aria-labelledby="pf-h-info">
            <h2 id="pf-h-info">Thông tin</h2>
            <div className="pf-fields">
              <div className="catalog-field">
                <label htmlFor="pf-productName">Tên sản phẩm *</label>
                <input id="pf-productName" className="catalog-input" value={values.productName} maxLength={255} onChange={(e) => set("productName", e.target.value)} {...invalid("productName")} />
                {err("productName")}
              </div>
              <div className="pf-row">
                <div className="catalog-field">
                  <label htmlFor="pf-categoryId">Danh mục *</label>
                  <select id="pf-categoryId" className="catalog-input" value={values.categoryId} onChange={(e) => set("categoryId", e.target.value)} {...invalid("categoryId")}>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
                  </select>
                  {err("categoryId")}
                </div>
                <div className="catalog-field">
                  <label htmlFor="pf-price">Giá bán *</label>
                  <div className="pf-money">
                    <MoneyInput id="pf-price" className="catalog-input" value={values.price} onChange={(v) => set("price", v)} placeholder="0" {...invalid("price")} />
                    <span className="pf-money-unit" aria-hidden="true">đ</span>
                  </div>
                  {err("price")}
                </div>
              </div>
            </div>
          </section>

          <section className="form-card" aria-labelledby="pf-h-detail">
            <h2 id="pf-h-detail">Chi tiết</h2>
            <div className="pf-row">
              <div className="catalog-field">
                <label htmlFor="pf-material">Chất liệu</label>
                <input id="pf-material" className="catalog-input" value={values.material} maxLength={100} onChange={(e) => set("material", e.target.value)} {...invalid("material")} />
                {err("material")}
              </div>
              <div className="catalog-field">
                <label htmlFor="pf-style">Kiểu dáng</label>
                <input id="pf-style" className="catalog-input" value={values.style} maxLength={100} onChange={(e) => set("style", e.target.value)} {...invalid("style")} />
                {err("style")}
              </div>
            </div>
          </section>

          <section className="form-card" aria-labelledby="pf-h-desc">
            <h2 id="pf-h-desc">Mô tả</h2>
            <div className="catalog-field">
              <label className="sr-only" htmlFor="pf-description">Mô tả</label>
              <textarea ref={descRef} id="pf-description" className="catalog-input pf-desc" rows={4} value={values.description} onChange={(e) => set("description", e.target.value)} placeholder="Chất liệu, kiểu dáng, cách dùng…" {...invalid("description")} />
              {err("description")}
              <p className="pf-count">{formatNumber(values.description.length)} ký tự</p>
            </div>
          </section>
        </div>

        <div className="form-side">
          <section className="form-card" aria-labelledby="pf-h-image">
            <h2 id="pf-h-image">Ảnh</h2>
            <ImageDrop
              preview={preview}
              alt={values.productName || "Ảnh sản phẩm"}
              accept={IMAGE_TYPES}
              inputRef={imageInput}
              disabled={busy || uploading}
              onFile={(file) => void pickFile(file)}
              onReject={(message) => { setImageNote(message); toast.error(message); }}
              hint="PNG hoặc JPG, tối đa 5MB"
            />
            {uploading ? <p className="pf-image-note" role="status">Đang tải ảnh…</p> : imageNote ? <p className="pf-image-note" role="status">{imageNote}</p> : null}
            <div className="pf-image-actions">
              {preview ? <button type="button" className="secondary btn-sm" disabled={busy || uploading} onClick={() => imageInput.current?.click()}>Đổi ảnh</button> : null}
              {preview ? <button type="button" className="secondary btn-sm" disabled={busy || uploading} onClick={() => { setPending(null); set("imageUrl", ""); setImageNote(""); }}>Bỏ ảnh</button> : null}
              <button type="button" className="secondary btn-sm" aria-expanded={urlOpen} disabled={busy || uploading} onClick={() => setUrlOpen((v) => !v)}>Dán URL</button>
            </div>
            {urlOpen ? (
              <div className="catalog-field pf-url">
                <label className="sr-only" htmlFor="pf-imageUrl">URL ảnh</label>
                <input
                  id="pf-imageUrl"
                  className="catalog-input"
                  value={values.imageUrl.startsWith("/api/") ? "" : values.imageUrl}
                  onChange={(e) => { setPending(null); set("imageUrl", e.target.value); }}
                  placeholder={values.imageUrl.startsWith("/api/") ? "Đang dùng ảnh đã tải lên. Dán URL mới để thay." : "https://…"}
                  autoFocus
                />
                {err("imageUrl")}
              </div>
            ) : null}
          </section>

          <section className="form-card" aria-labelledby="pf-h-status">
            <h2 id="pf-h-status">Trạng thái</h2>
            <div className="pf-status">
              <StatusBadge status={statusKey} label={statusLabel} />
              {publication ? <span className={`badge t-${publication.tone}`}>{publication.label}</span> : null}
            </div>
            <p className="pf-status-line">
              Thay đổi được lưu vào Draft, nội dung đang bán chỉ đổi khi bạn Publish.
              <InfoHint align="end">SKU được thêm hoặc sửa riêng ở trang chi tiết để giữ mã đã dùng trong đơn.</InfoHint>
            </p>
          </section>
        </div>
      </div>

      {conflict ? <p className="catalog-error" role="alert">{conflict}</p> : null}

      <div className="action-bar pf-actions">
        <span className={`pf-dirty${dirty ? " on" : ""}`} role="status" aria-live="polite">{dirty ? <><span className="pf-dirty-dot" aria-hidden="true" />Có thay đổi chưa lưu</> : ""}</span>
        <button className="secondary" type="button" disabled={busy} onClick={() => router.back()}>Hủy</button>
        <button className="primary" type="submit" disabled={busy || uploading} aria-disabled={busy || uploading}>
          {busy ? "Đang lưu…" : mode === "create" ? "Lưu Draft" : "Lưu vào Draft"}
        </button>
      </div>
    </form>
  );
}
