"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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

export function ProductForm({ mode, product, categories }: { mode: "create" | "edit"; product?: Product; categories: Category[] }) {
  const router = useRouter();
  const [values, setValues] = useState({
    productName: product?.productName ?? "",
    categoryId: String(product?.categoryId ?? categories[0]?.id ?? ""),
    material: product?.material ?? "",
    style: product?.style ?? "",
    description: product?.description ?? "",
    price: product ? String(product.price) : "",
    imageUrl: product?.imageUrl ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState("");
  const [field, setField] = useState("");
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  function set(key: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    if (field === key) setField("");
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const price = Number(values.price);
    if (!values.productName.trim()) { setError("Nhập tên sản phẩm."); setField("productName"); return; }
    if (!values.categoryId) { setError("Chọn danh mục."); setField("categoryId"); return; }
    if (!Number.isFinite(price) || price < 0) { setError("Giá bán phải là số không âm."); setField("price"); return; }
    setBusy(true); setError(""); setConflict(""); setField("");
    try {
      if (mode === "create") {
        const draft = await createDraft(fields());
        // Bản nháp mới KHÔNG có productId cho tới khi xuất bản — không bao giờ
        // dùng draftId như productId (đó là hai không gian ID khác nhau).
        router.replace(`/quan-tri/san-pham/nhap/${draft.draftId}`);
        return;
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
      router.replace(`/quan-tri/san-pham/${id}`);
    } catch (failure) {
      if (failure instanceof CatalogAdminError && failure.status === 409) {
        setConflict(
          "Bản nháp đã thay đổi ở phiên khác (409). Mở trang chi tiết để tải phiên bản mới rồi lưu lại — nội dung đang bán không bị ghi đè.",
        );
        return;
      }
      setError(failure instanceof Error ? failure.message : "Không lưu được bản nháp.");
      const errors = (failure as { errors?: Array<{ field?: string }> }).errors;
      if (errors?.[0]?.field) setField(errors[0].field || "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="catalog-form" onSubmit={submit} noValidate aria-busy={busy}>
      <div className="catalog-field">
        <label htmlFor="pf-name">Tên sản phẩm *</label>
        <input ref={(el) => { if (field === "productName") ref.current = el; }} id="pf-name" className="catalog-input" value={values.productName} maxLength={255} onChange={(e) => set("productName", e.target.value)} aria-invalid={field === "productName" || undefined} />
      </div>
      <div className="catalog-field">
        <label htmlFor="pf-category">Danh mục *</label>
        <select id="pf-category" className="catalog-input" value={values.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
        </select>
      </div>
      <div className="catalog-field">
        <label htmlFor="pf-price">Giá bán (VND) *</label>
        <input id="pf-price" className="catalog-input" inputMode="decimal" value={values.price} onChange={(e) => set("price", e.target.value)} aria-invalid={field === "price" || undefined} />
      </div>
      <div className="catalog-field">
        <label htmlFor="pf-material">Chất liệu</label>
        <input id="pf-material" className="catalog-input" value={values.material} maxLength={100} onChange={(e) => set("material", e.target.value)} />
      </div>
      <div className="catalog-field">
        <label htmlFor="pf-style">Kiểu dáng</label>
        <input id="pf-style" className="catalog-input" value={values.style} maxLength={100} onChange={(e) => set("style", e.target.value)} />
      </div>
      <div className="catalog-field">
        <label htmlFor="pf-image">URL ảnh (hoặc tải ảnh bản nháp bên dưới)</label>
        <input id="pf-image" className="catalog-input" value={values.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" />
      </div>
      {mode === "edit" && product ? (
        <div className="catalog-field">
          <label htmlFor="pf-file">Tải ảnh vào bản nháp (PNG/JPG, tối đa 5MB)</label>
          <input
            id="pf-file"
            type="file"
            accept="image/png,image/jpeg"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file || busy) return;
              setBusy(true); setError("");
              try {
                const drafts = await listDrafts("page=0&size=50");
                let draft = drafts.find((d) => d.productId === product.id);
                if (!draft) draft = await createDraft({ ...fields(), productId: product.id });
                const result = await uploadDraftImage(draft.draftId, file);
                if (result.imageUrl) set("imageUrl", result.imageUrl);
              } catch (failure) {
                setError(failure instanceof Error ? failure.message : "Không tải được ảnh.");
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          />
          <button type="button" className="text-link" onClick={() => set("imageUrl", "")} disabled={busy}>Bỏ ảnh</button>
          {values.imageUrl ? <p className="meta" style={{ marginTop: 4 }}>Ảnh trong bản nháp: {values.imageUrl}</p> : null}
        </div>
      ) : null}
      <div className="catalog-field">
        <label htmlFor="pf-description">Mô tả</label>
        <textarea id="pf-description" className="catalog-input" value={values.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      {error ? <p className="catalog-error" role="alert">{error}</p> : null}
      {conflict ? <p className="catalog-error" role="alert">{conflict}</p> : null}
      <div className="catalog-actions">
        <button className="primary" type="submit" disabled={busy} aria-disabled={busy}>
          {busy ? "Đang lưu…" : mode === "create" ? "Lưu bản nháp" : "Lưu thay đổi vào bản nháp"}
        </button>
        <button className="text-link" type="button" onClick={() => router.back()}>Hủy</button>
      </div>
      <p className="meta">
        Thay đổi được lưu vào bản nháp; nội dung đang bán chỉ đổi khi bạn bấm Xuất bản ở trang chi tiết. SKU thêm/sửa riêng để giữ ID và barcode.
      </p>
    </form>
  );
}
