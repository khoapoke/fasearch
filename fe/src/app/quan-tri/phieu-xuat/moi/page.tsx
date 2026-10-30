"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { useAdminRole } from "@/components/admin-b/use-admin-role";
import { createExport, ExportError } from "@/lib/admin-export-client";
import { getStockPage, type Stock } from "@/lib/admin-stock-client";
type Line = { key: number; skuId: string; quantity: string; reason: string };
const TYPE: Array<[string, string]> = [["DAMAGED", "Hàng hỏng"], ["OTHER", "Khác"]];
export default function NewExportPage() {
  const role = useAdminRole(); const router = useRouter(); const [stock, setStock] = useState<Stock[]>([]); const [type, setType] = useState("DAMAGED"); const [note, setNote] = useState(""); const [lines, setLines] = useState<Line[]>([{ key: 1, skuId: "", quantity: "1", reason: "" }]); const [error, setError] = useState(""); const [uncertain, setUncertain] = useState(false); const [busy, setBusy] = useState(false); const busyRef = useRef(false); const nextKey = useRef(2);
  useEffect(() => { if (role !== "ADMIN") return; const c = new AbortController(); getStockPage("page=0&size=50", c.signal).then((p) => setStock(p.content)).catch((e) => setError(e instanceof Error ? e.message : "Không tải được SKU.")); return () => c.abort(); }, [role]);
  function update(key: number, field: keyof Line, value: string) { setLines((ls) => ls.map((l) => l.key === key ? { ...l, [field]: value } : l)); }
  function add() { setLines((ls) => [...ls, { key: nextKey.current++, skuId: "", quantity: "1", reason: "" }]); }
  function remove(key: number) { setLines((ls) => ls.length === 1 ? ls : ls.filter((l) => l.key !== key)); }
  const selectedStock = (id: string) => stock.find((s) => String(s.skuId) === id);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busyRef.current) return;
    const items = lines.map((l) => ({ skuId: Number(l.skuId), quantity: Number(l.quantity), reason: l.reason }));
    if (items.some((i) => !Number.isSafeInteger(i.skuId) || i.skuId < 1)) { setError("Chọn SKU cho mọi dòng."); return; }
    if (new Set(items.map((i) => i.skuId)).size !== items.length) { setError("Mỗi SKU chỉ được xuất hiện một lần trong phiếu."); return; }
    if (items.some((i) => !Number.isSafeInteger(i.quantity) || i.quantity < 1)) { setError("Số lượng xuất phải là số nguyên dương."); return; }
    if (items.some((i) => (i.reason ?? "").length > 255)) { setError("Lý do xuất tối đa 255 ký tự."); return; }
    for (const i of items) { const s = selectedStock(String(i.skuId)); if (s?.availableStock !== null && s?.availableStock !== undefined && i.quantity > s.availableStock) { setError(`SKU ${i.skuId} chỉ còn ${s.availableStock} khả dụng.`); return; } }
    busyRef.current = true; setBusy(true); setError(""); setUncertain(false);
    try { const receipt = await createExport({ exportType: type, note, items }); router.push(`/quan-tri/phieu-xuat/${receipt.receiptId}`); }
    catch (failure) { if (failure instanceof ExportError) setError(failure.message); else { setUncertain(true); setError("Chưa xác định được phiếu đã được tạo hay chưa. Không gửi lại tự động; mở danh sách phiếu xuất để đối soát."); } }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <AdminShellB active="exports" title="Tạo phiếu xuất" eyebrow="Vận hành · ADMIN"><div className="page-heading"><div><h1>Tạo phiếu xuất</h1><p className="meta">Phiếu COMPLETED trừ physical/available ngay; reserved giữ nguyên. Không phải draft/duyệt.</p></div><Link className="text-link" href="/quan-tri/phieu-xuat">← Danh sách</Link></div>
    {role && role !== "ADMIN" ? <div className="order-empty"><strong>Chỉ ADMIN được tạo phiếu xuất</strong><p>STAFF chỉ đọc; form ghi không được hiển thị.</p><Link className="text-link" href="/quan-tri/phieu-xuat">Về danh sách</Link></div> : !role ? <p className="meta" role="status">Đang kiểm tra quyền…</p> : (
      <form className="catalog-form" onSubmit={submit} aria-busy={busy}>
        <div className="catalog-field"><label htmlFor="exp-type">Loại xuất *</label><select id="exp-type" className="catalog-input" value={type} onChange={(e) => setType(e.target.value)}>{TYPE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><p className="meta">TRANSFER không có hợp đồng kho đích nên không hỗ trợ.</p></div>
        <div className="catalog-field"><label htmlFor="exp-note">Ghi chú</label><input id="exp-note" className="catalog-input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <div className="import-lines">{lines.map((l, index) => { const s = selectedStock(l.skuId); return <div className="import-line" key={l.key}><div className="catalog-field"><label htmlFor={`exp-sku-${l.key}`}>SKU dòng {index + 1} *</label><select id={`exp-sku-${l.key}`} className="catalog-input" value={l.skuId} onChange={(e) => update(l.key, "skuId", e.target.value)}><option value="">— Chọn SKU —</option>{stock.map((x) => <option key={x.skuId} value={x.skuId}>{x.skuId} · {x.productName} · {[x.color, x.size].filter(Boolean).join("/")} · khả dụng {x.availableStock ?? "?"}</option>)}</select>{s ? <small className="meta">Khả dụng {s.availableStock ?? "không có dữ liệu"} · giữ {s.reservedStock ?? "?"}</small> : null}</div><div className="catalog-field"><label htmlFor={`exp-qty-${l.key}`}>SL *</label><input id={`exp-qty-${l.key}`} className="catalog-input" inputMode="numeric" value={l.quantity} onChange={(e) => update(l.key, "quantity", e.target.value)} /></div><div className="catalog-field"><label htmlFor={`exp-reason-${l.key}`}>Lý do (≤255)</label><input id={`exp-reason-${l.key}`} className="catalog-input" maxLength={255} value={l.reason} onChange={(e) => update(l.key, "reason", e.target.value)} /></div><div /><button className="text-link" type="button" disabled={lines.length === 1} onClick={() => remove(l.key)}>Xóa dòng</button></div>})}</div>
        <div className="catalog-actions"><button className="text-link" type="button" onClick={add}>+ Thêm dòng</button><span className="meta">Client kiểm tra khả dụng; BE là nguồn quyết định cuối.</span></div>
        {error ? <p className="catalog-error" role="alert">{error}</p> : null}{uncertain ? <p className="catalog-error" role="alert">Không tự retry. <Link className="text-link" href="/quan-tri/phieu-xuat">Mở danh sách phiếu xuất để đối soát →</Link></p> : null}
        <div className="catalog-actions"><button className="primary" type="submit" disabled={busy || !stock.length}>{busy ? "Đang tạo phiếu…" : "Tạo phiếu và trừ kho"}</button><Link className="text-link" href="/quan-tri/phieu-xuat">Hủy</Link></div>
        <p className="meta">Mỗi SKU một dòng; phiếu một POST duy nhất. Không có totalAmount/valuation vì DTO không có. Không có auto retry khi mất phản hồi.</p>
      </form>)}
  </AdminShellB>;
}
