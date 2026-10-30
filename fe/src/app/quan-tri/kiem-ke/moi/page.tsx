"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { useAdminRole } from "@/components/admin-b/use-admin-role";
import { getStockPage, type Stock } from "@/lib/admin-stock-client";
import { createStocktake, signed, StocktakeError } from "@/lib/admin-stocktake-client";
type Line = { key: number; skuId: string; actualCount: string };
const MAX_COUNT = 1_000_000;
export default function NewStocktakePage() {
  const role = useAdminRole(); const router = useRouter();
  const [stock, setStock] = useState<Stock[]>([]);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([{ key: 1, skuId: "", actualCount: "0" }]);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); const nextKey = useRef(2);
  useEffect(() => {
    if (role !== "ADMIN" && role !== "STAFF") return;
    const c = new AbortController();
    getStockPage("page=0&size=50", c.signal).then((p) => setStock(p.content)).catch((e) => setError(e instanceof Error ? e.message : "Không tải được SKU."));
    return () => c.abort();
  }, [role]);
  function update(key: number, field: keyof Line, value: string) { setLines((ls) => ls.map((l) => l.key === key ? { ...l, [field]: value } : l)); }
  function add() { setLines((ls) => [...ls, { key: nextKey.current++, skuId: "", actualCount: "0" }]); }
  function remove(key: number) { setLines((ls) => ls.length === 1 ? ls : ls.filter((l) => l.key !== key)); }
  const selectedStock = (id: string) => stock.find((s) => String(s.skuId) === id);
  function focus(id: string) { window.requestAnimationFrame(() => document.getElementById(id)?.focus()); }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busyRef.current) return;
    if (note.length > 1000) { setError("Ghi chú tối đa 1000 ký tự."); focus("st-note"); return; }
    const parsed: Array<{ skuId: number; actualCount: number }> = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]; const skuId = Number(line.skuId);
      if (!line.skuId || !Number.isSafeInteger(skuId) || skuId < 1) { setError(`Chọn SKU cho dòng ${i + 1}.`); focus(`st-sku-${line.key}`); return; }
      if (!/^\d+$/.test(line.actualCount)) { setError(`Số đếm dòng ${i + 1} phải là số nguyên không âm.`); focus(`st-actual-${line.key}`); return; }
      const actualCount = Number(line.actualCount);
      if (!Number.isSafeInteger(actualCount) || actualCount < 0 || actualCount > MAX_COUNT) { setError(`Số đếm dòng ${i + 1} phải từ 0 đến 1.000.000.`); focus(`st-actual-${line.key}`); return; }
      parsed.push({ skuId, actualCount });
    }
    for (let i = 0; i < parsed.length; i++) {
      if (parsed.findIndex((x) => x.skuId === parsed[i].skuId) !== i) { setError("Mỗi SKU chỉ được xuất hiện một lần trong phiếu."); focus(`st-sku-${lines[i].key}`); return; }
    }
    const records = parsed;
    busyRef.current = true; setBusy(true); setError(""); setUncertain(false);
    try { const saved = await createStocktake({ note, records }); router.push(`/quan-tri/kiem-ke/${saved.stocktakeId}`); }
    catch (failure) {
      if (failure instanceof StocktakeError) setError(failure.message);
      else { setUncertain(true); setError("Chưa xác định được phiếu đã được ghi nhận hay chưa. Không gửi lại tự động; mở danh sách kiểm kê để đối soát."); }
    } finally { busyRef.current = false; setBusy(false); }
  }
  const canWrite = role === "ADMIN" || role === "STAFF";
  return <AdminShellB active="stocktakes" title="Tạo phiếu kiểm kê" eyebrow="Vận hành · ADMIN và STAFF">
    <div className="page-heading"><div><h1>Tạo phiếu kiểm kê</h1><p className="meta">Chỉ ghi nhận số đếm thực tế. BE lưu snapshot hệ thống và chuyển PENDING_APPROVAL; không trừ/cộng tồn.</p></div><Link className="text-link" href="/quan-tri/kiem-ke">← Danh sách</Link></div>
    {role && !canWrite ? <div className="order-empty"><strong>Chỉ ADMIN hoặc STAFF được tạo phiếu kiểm kê</strong><p>Tài khoản hiện tại không có quyền ghi nhận.</p><Link className="text-link" href="/quan-tri/kiem-ke">Về danh sách</Link></div> : !role ? <p className="meta" role="status">Đang kiểm tra quyền…</p> : (
      <form className="catalog-form stocktake-form" onSubmit={submit} aria-busy={busy}>
        <div className="catalog-field"><label htmlFor="st-note">Ghi chú (≤1000)</label><textarea id="st-note" className="catalog-input stocktake-note-input" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} rows={3} /></div>
        <div className="import-lines">{lines.map((l, index) => { const s = selectedStock(l.skuId); const actual = /^\d+$/.test(l.actualCount) ? Number(l.actualCount) : null; const system = s?.physicalStock ?? null; const diff = actual !== null && system !== null ? actual - system : null; return <div className="import-line stocktake-line" key={l.key}>
          <div className="catalog-field"><label htmlFor={`st-sku-${l.key}`}>SKU dòng {index + 1} *</label><select id={`st-sku-${l.key}`} className="catalog-input" value={l.skuId} onChange={(e) => update(l.key, "skuId", e.target.value)}><option value="">— Chọn SKU —</option>{stock.map((x) => <option key={x.skuId} value={x.skuId}>{x.skuId} · {x.productName} · {[x.color, x.size].filter(Boolean).join("/")} · hệ thống {x.physicalStock ?? "?"}</option>)}</select>{s ? <small className="meta">Hệ thống {s.physicalStock ?? "không có dữ liệu"} · tạm giữ {s.reservedStock ?? "?"} · khả dụng {s.availableStock ?? "?"} (chỉ tham khảo)</small> : null}</div>
          <div className="catalog-field"><label htmlFor={`st-actual-${l.key}`}>Đếm thực tế *</label><input id={`st-actual-${l.key}`} className="catalog-input" inputMode="numeric" maxLength={7} value={l.actualCount} onChange={(e) => update(l.key, "actualCount", e.target.value)} /><small className="meta">0 là hợp lệ</small></div>
          <div className="catalog-field"><span className="meta">Lệch tạm tính</span><strong className={`stocktake-diff ${diff !== null && diff > 0 ? "pos" : diff !== null && diff < 0 ? "neg" : ""}`}>{diff === null ? "—" : signed(diff)}</strong><small className="meta">Server chốt snapshot</small></div>
          <button className="text-link" type="button" disabled={lines.length === 1} onClick={() => remove(l.key)}>Xóa dòng</button>
        </div>})}</div>
        <div className="catalog-actions"><button className="text-link" type="button" onClick={add}>+ Thêm dòng</button><span className="meta">Mỗi SKU một lần · một POST · không tự retry.</span></div>
        {error ? <p className="catalog-error" role="alert">{error}</p> : null}{uncertain ? <p className="catalog-error" role="alert">Không tự retry. <Link className="text-link" href="/quan-tri/kiem-ke">Mở danh sách kiểm kê để đối soát →</Link></p> : null}
        <div className="catalog-actions"><button className="primary" type="submit" disabled={busy || !stock.length}>{busy ? "Đang ghi nhận…" : "Ghi nhận phiếu kiểm kê"}</button><Link className="text-link" href="/quan-tri/kiem-ke">Hủy</Link></div>
        <p className="meta">Không có duyệt/áp dụng/warehouse/version-409 trong candidate. Tồn physical/reserved/available sẽ giữ nguyên sau khi ghi nhận.</p>
      </form>)}
  </AdminShellB>;
}
