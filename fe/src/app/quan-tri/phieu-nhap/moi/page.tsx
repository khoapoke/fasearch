"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { useAdminRole, canManage } from "@/components/admin-b/use-admin-role";
import { SkuPicker } from "@/components/admin-b/sku-picker";
import { createImport, money, StockError } from "@/lib/admin-stock-client";
type Line = { key: number; skuId: string; quantity: string; price: string };
export default function NewImportPage() {
  const role = useAdminRole(); const router = useRouter();
  const [supplier, setSupplier] = useState(""); const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>(() => {
    const q = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("sku");
    return [{ key: 1, skuId: q && /^[1-9]\d*$/.test(q) ? q : "", quantity: "1", price: "" }];
  });
  const [error, setError] = useState(""); const [uncertain, setUncertain] = useState(false); const [busy, setBusy] = useState(false); const busyRef = useRef(false); const nextKey = useRef(2);
  const estimate = lines.reduce((n, l) => { const q = Number(l.quantity); const p = Number(l.price); return n + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0); }, 0);
  function update(key: number, field: keyof Line, value: string) { setLines((ls) => ls.map((l) => l.key === key ? { ...l, [field]: value } : l)); }
  function add() { const key = nextKey.current++; setLines((ls) => [...ls, { key, skuId: "", quantity: "1", price: "" }]); }
  function remove(key: number) { setLines((ls) => ls.length === 1 ? ls : ls.filter((l) => l.key !== key)); }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busyRef.current) return;
    if (!supplier.trim()) { setError("Nhập tên nhà cung cấp."); return; }
    const items = lines.map((l) => ({ skuId: Number(l.skuId), quantity: Number(l.quantity), importPrice: Number(l.price) }));
    if (items.some((i) => !Number.isSafeInteger(i.skuId) || i.skuId < 1)) { setError("Chọn SKU cho mọi dòng."); return; }
    if (new Set(items.map((i) => i.skuId)).size !== items.length) { setError("Mỗi SKU chỉ được xuất hiện một lần trong phiếu."); return; }
    if (items.some((i) => !Number.isSafeInteger(i.quantity) || i.quantity < 1)) { setError("Số lượng phải là số nguyên dương."); return; }
    if (items.some((i) => !Number.isFinite(i.importPrice) || i.importPrice <= 0)) { setError("Giá nhập phải lớn hơn 0."); return; }
    busyRef.current = true; setBusy(true); setError(""); setUncertain(false);
    try {
      const receipt = await createImport({ supplierName: supplier.trim(), note, items });
      router.push(`/quan-tri/phieu-nhap/${receipt.receiptId}`);
    } catch (failure) {
      if (failure instanceof StockError) setError(failure.message);
      else { setUncertain(true); setError("Chưa xác định được phiếu đã được tạo hay chưa. Không gửi lại tự động; mở danh sách phiếu để đối soát."); }
    } finally { busyRef.current = false; setBusy(false); }
  }
  return <AdminShellB active="imports" title="Tạo phiếu nhập" eyebrow="Vận hành"><div className="page-heading"><div><h1>Tạo phiếu nhập</h1><p className="meta">Phiếu tạo xong là COMPLETED và cộng tồn kho ngay; không phải draft/approve.</p></div><Link className="text-link" href="/quan-tri/phieu-nhap">← Danh sách</Link></div>
    {role && !canManage(role) ? <div className="order-empty"><strong>Chỉ Quản trị viên hoặc Quản lý được tạo phiếu nhập</strong><p>Tài khoản hiện tại chỉ đọc; form ghi không được hiển thị.</p><Link className="text-link" href="/quan-tri/phieu-nhap">Về danh sách</Link></div> : !role ? <p className="meta" role="status">Đang kiểm tra quyền…</p> : (
      <form className="catalog-form" onSubmit={submit} aria-busy={busy}>
        <div className="catalog-field"><label htmlFor="imp-supplier">Nhà cung cấp *</label><input id="imp-supplier" className="catalog-input" value={supplier} maxLength={255} onChange={(e) => setSupplier(e.target.value)} /></div>
        <div className="catalog-field"><label htmlFor="imp-note">Ghi chú</label><input id="imp-note" className="catalog-input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <div className="import-lines">{lines.map((l, index) => <div className="import-line" key={l.key}><div className="catalog-field"><label htmlFor={`imp-sku-${l.key}`}>SKU dòng {index + 1} *</label><SkuPicker id={`imp-sku-${l.key}`} value={l.skuId} mode="any" onChange={(skuId) => update(l.key, "skuId", skuId)} /></div><div className="catalog-field"><label htmlFor={`imp-qty-${l.key}`}>SL *</label><input id={`imp-qty-${l.key}`} className="catalog-input" inputMode="numeric" value={l.quantity} onChange={(e) => update(l.key, "quantity", e.target.value)} /></div><div className="catalog-field"><label htmlFor={`imp-price-${l.key}`}>Giá nhập *</label><input id={`imp-price-${l.key}`} className="catalog-input" inputMode="decimal" value={l.price} onChange={(e) => update(l.key, "price", e.target.value)} /></div><div className="meta">{money((Number(l.quantity) || 0) * (Number(l.price) || 0))}</div><button className="text-link" type="button" disabled={lines.length === 1} onClick={() => remove(l.key)}>Xóa dòng</button></div>)}</div>
        <div className="catalog-actions"><button className="text-link" type="button" onClick={add}>+ Thêm dòng</button><span className="meta">Ước tính phía trình duyệt</span></div>
        <div className="import-estimate"><span>Tổng ước tính</span><strong>{money(estimate)}</strong></div>
        {error ? <p className="catalog-error" role="alert">{error}</p> : null}{uncertain ? <p className="catalog-error" role="alert">Không tự retry. <Link className="text-link" href="/quan-tri/phieu-nhap">Mở danh sách phiếu để đối soát →</Link></p> : null}
        <div className="catalog-actions"><button className="primary" type="submit" disabled={busy}>{busy ? "Đang tạo phiếu…" : "Tạo phiếu và cộng kho"}</button><Link className="text-link" href="/quan-tri/phieu-nhap">Hủy</Link></div>
        <p className="meta">Gõ để tìm SKU trong toàn catalog (mã SKU, tên sản phẩm, barcode); mỗi dòng hiển thị tồn khả dụng/vật lý. Mỗi SKU một dòng; BE cộng physical/available ngay và giữ reserved. Tổng tiền/quantity thật lấy từ response; ước tính chỉ để xem trước.</p>
      </form>)}
  </AdminShellB>;
}
