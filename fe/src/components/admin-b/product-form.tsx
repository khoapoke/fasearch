"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createProduct, updateProduct, type Category, type Product } from "@/lib/admin-catalog-client";
const STATUS: Array<[string, string]> = [["DRAFT", "Nháp"], ["ACTIVE", "Đang bán"], ["OUT_OF_STOCK", "Tạm hết hàng"], ["DISCONTINUED", "Ngừng kinh doanh"]];
export function ProductForm({ mode, product, categories }: { mode: "create" | "edit"; product?: Product; categories: Category[] }) {
  const router = useRouter();
  const [values, setValues] = useState({
    productName: product?.productName ?? "", categoryId: String(product?.categoryId ?? categories[0]?.id ?? ""),
    material: product?.material ?? "", style: product?.style ?? "", description: product?.description ?? "",
    price: product ? String(product.price) : "", imageUrl: product?.imageUrl ?? "", status: product?.status ?? "ACTIVE",
  });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [field, setField] = useState("");
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);
  function set(key: keyof typeof values, value: string) { setValues((v) => ({ ...v, [key]: value })); if (field === key) setField(""); }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy) return;
    const price = Number(values.price);
    if (!values.productName.trim()) { setError("Nhập tên sản phẩm."); setField("productName"); return; }
    if (!values.categoryId) { setError("Chọn danh mục."); setField("categoryId"); return; }
    if (!Number.isFinite(price) || price < 0) { setError("Giá bán phải là số không âm."); setField("price"); return; }
    setBusy(true); setError(""); setField("");
    const body = { productName: values.productName.trim(), categoryId: Number(values.categoryId), material: values.material.trim(), style: values.style.trim(), description: values.description, price, imageUrl: values.imageUrl.trim(), status: values.status };
    try {
      const saved = mode === "create" ? await createProduct(body) : await updateProduct(String(product?.id), body);
      router.replace(`/quan-tri/san-pham/${saved.id}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không lưu được sản phẩm.");
      const errors = (failure as { errors?: Array<{ field?: string }> }).errors;
      if (errors?.[0]?.field) setField(errors[0].field || "");
    } finally { setBusy(false); }
  }
  return <form className="catalog-form" onSubmit={submit} noValidate aria-busy={busy}>
    <div className="catalog-field"><label htmlFor="pf-name">Tên sản phẩm *</label><input ref={(el) => { if (field === "productName") ref.current = el; }} id="pf-name" className="catalog-input" value={values.productName} maxLength={255} onChange={(e) => set("productName", e.target.value)} aria-invalid={field === "productName" || undefined} /></div>
    <div className="catalog-field"><label htmlFor="pf-category">Danh mục *</label><select id="pf-category" className="catalog-input" value={values.categoryId} onChange={(e) => set("categoryId", e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.categoryName}</option>)}</select></div>
    <div className="catalog-field"><label htmlFor="pf-price">Giá bán (VND) *</label><input id="pf-price" className="catalog-input" inputMode="decimal" value={values.price} onChange={(e) => set("price", e.target.value)} aria-invalid={field === "price" || undefined} /></div>
    <div className="catalog-field"><label htmlFor="pf-material">Chất liệu</label><input id="pf-material" className="catalog-input" value={values.material} maxLength={100} onChange={(e) => set("material", e.target.value)} /></div>
    <div className="catalog-field"><label htmlFor="pf-style">Kiểu dáng</label><input id="pf-style" className="catalog-input" value={values.style} maxLength={100} onChange={(e) => set("style", e.target.value)} /></div>
    <div className="catalog-field"><label htmlFor="pf-image">URL ảnh (không phải upload)</label><input id="pf-image" className="catalog-input" value={values.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" /></div>
    <div className="catalog-field"><label htmlFor="pf-description">Mô tả</label><textarea id="pf-description" className="catalog-input" value={values.description} onChange={(e) => set("description", e.target.value)} /></div>
    <div className="catalog-field"><label htmlFor="pf-status">Trạng thái</label><select id="pf-status" className="catalog-input" value={values.status} onChange={(e) => set("status", e.target.value)}>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
    {error ? <p className="catalog-error" role="alert">{error}</p> : null}
    <div className="catalog-actions"><button className="primary" type="submit" disabled={busy}>{busy ? "Đang lưu…" : mode === "create" ? "Tạo sản phẩm" : "Lưu metadata"}</button><button className="text-link" type="button" onClick={() => router.back()}>Hủy</button></div>
    <p className="meta">Lưu metadata không gửi variants; SKU được thêm/sửa riêng để giữ ID và barcode. Không có upload/tồn kho trong DTO.</p>
  </form>;
}
