"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/admin-b/toast";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { PageHeader } from "@/components/admin-b/page-header";
import { useAdminRole, useAdminCan } from "@/components/admin-b/use-admin-role";
import { Icon } from "@/components/admin-b/icons";
import { Num } from "@/components/admin-b/status-badge";
import { SkuPicker, skuLabel } from "@/components/admin-b/sku-picker";
import { BarcodeScanInput, type ScanResult } from "@/components/admin-b/barcode-scan-input";
import { createExport, ExportError } from "@/lib/admin-export-client";
import type { Stock } from "@/lib/admin-stock-client";
type Line = { key: number; skuId: string; quantity: string; reason: string };
const TYPE: Array<[string, string]> = [["DAMAGED", "Hàng hỏng"], ["OTHER", "Khác"]];
export default function NewExportPage() {
  const role = useAdminRole(); const can = useAdminCan(); const router = useRouter(); const toast = useToast(); const [type, setType] = useState("DAMAGED"); const [note, setNote] = useState(""); const [lines, setLines] = useState<Line[]>([{ key: 1, skuId: "", quantity: "1", reason: "" }]); const [picked, setPicked] = useState<Record<number, Stock | null>>({}); const [error, setError] = useState(""); const [uncertain, setUncertain] = useState(false); const [tried, setTried] = useState(false); const [busy, setBusy] = useState(false); const busyRef = useRef(false); const nextKey = useRef(2);
  const linesRef = useRef(lines); useEffect(() => { linesRef.current = lines; });
  const [hit, setHit] = useState<number | null>(null); const hitTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hitTimer.current), []);
  function flashLine(key: number) { setHit(key); window.clearTimeout(hitTimer.current); hitTimer.current = window.setTimeout(() => setHit(null), 1400); window.requestAnimationFrame(() => document.querySelector(`[data-line-key="${key}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })); }
  // Barcode scanner: add the SKU as a line, or add one to its quantity (never above the available stock).
  function scan(stock: Stock): ScanResult {
    touch();
    const id = String(stock.skuId); const cur = linesRef.current; const existing = cur.find((l) => l.skuId === id);
    const avail = stock.availableStock;
    if (existing) {
      const q = Number(existing.quantity); const next = (Number.isSafeInteger(q) && q >= 1 ? q : 0) + 1;
      if (avail !== null && avail !== undefined && next > avail) return { ok: false, message: `${skuLabel(stock)}: chỉ còn ${avail} khả dụng.` };
      const out = cur.map((l) => l.key === existing.key ? { ...l, quantity: String(next) } : l); linesRef.current = out; setLines(out); setPicked((m) => ({ ...m, [existing.key]: stock })); flashLine(existing.key);
      return { ok: true, message: `${skuLabel(stock)}: số lượng ${next}.` };
    }
    const empty = cur.find((l) => l.skuId === ""); let key: number;
    if (empty) { key = empty.key; const out = cur.map((l) => l.key === key ? { ...l, skuId: id, quantity: "1" } : l); linesRef.current = out; setLines(out); }
    else { key = nextKey.current++; const out = [...cur, { key, skuId: id, quantity: "1", reason: "" }]; linesRef.current = out; setLines(out); }
    setPicked((m) => ({ ...m, [key]: stock })); flashLine(key);
    return { ok: true, message: `Đã thêm ${skuLabel(stock)}.` };
  }
  function touch() { setError(""); setUncertain(false); }
  function update(key: number, field: keyof Line, value: string) { touch(); setLines((ls) => ls.map((l) => l.key === key ? { ...l, [field]: value } : l)); }
  function pick(key: number, skuId: string, stock: Stock | null) { update(key, "skuId", skuId); setPicked((m) => ({ ...m, [key]: stock })); }
  function add() { touch(); const key = nextKey.current++; setLines((ls) => [...ls, { key, skuId: "", quantity: "1", reason: "" }]); }
  function remove(key: number) { touch(); setLines((ls) => ls.length === 1 ? ls : ls.filter((l) => l.key !== key)); setPicked((m) => { const n = { ...m }; delete n[key]; return n; }); }
  const selectedStock = (key: number) => picked[key] ?? null;
  // Derived from current values: an error disappears as soon as the field is valid.
  const lineErrors: Record<number, { sku?: string; qty?: string; reason?: string }> = {};
  { const seen = new Set<number>();
    for (const l of lines) {
      const e: { sku?: string; qty?: string; reason?: string } = {}; const skuId = Number(l.skuId); const q = Number(l.quantity); const s = selectedStock(l.key);
      if (!Number.isSafeInteger(skuId) || skuId < 1) e.sku = "Chọn SKU cho dòng này.";
      else if (seen.has(skuId)) e.sku = "SKU này đã có ở dòng khác.";
      else seen.add(skuId);
      if (!Number.isSafeInteger(q) || q < 1) e.qty = "Số nguyên dương.";
      else if (s?.availableStock !== null && s?.availableStock !== undefined && q > s.availableStock) e.qty = `Chỉ còn ${s.availableStock} khả dụng.`;
      if (l.reason.length > 255) e.reason = "Tối đa 255 ký tự.";
      if (e.sku || e.qty || e.reason) lineErrors[l.key] = e;
    } }
  const hasProblems = Object.keys(lineErrors).length > 0;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busyRef.current) return;
    if (hasProblems) {
      setTried(true);
      const first = lines.find((l) => lineErrors[l.key]); const er = first ? lineErrors[first.key] : undefined;
      if (first && er) { const target = er.sku ? `exp-sku-${first.key}` : er.qty ? `exp-qty-${first.key}` : `exp-reason-${first.key}`; window.requestAnimationFrame(() => document.getElementById(target)?.focus()); }
      return;
    }
    const items = lines.map((l) => ({ skuId: Number(l.skuId), quantity: Number(l.quantity), reason: l.reason }));
    busyRef.current = true; setBusy(true); setError(""); setUncertain(false);
    try { const receipt = await createExport({ exportType: type, note, items }); toast.success("Đã tạo phiếu xuất kho. Tồn kho đã được trừ."); router.push(`/quan-tri/phieu-xuat/${receipt.receiptId}`); return; }
    catch (failure) { if (failure instanceof ExportError) setError(failure.message); else { setUncertain(true); setError("Chưa xác định được phiếu đã được tạo hay chưa. Không gửi lại tự động; mở danh sách phiếu xuất để đối soát."); } busyRef.current = false; setBusy(false); }
  }
  const totalQty = lines.reduce((n, l) => n + (Number.isFinite(Number(l.quantity)) ? Number(l.quantity) : 0), 0);
  return <AdminShellB active="exports" title="Tạo phiếu xuất">
    <Link className="back-link" href="/quan-tri/phieu-xuat">← Phiếu xuất</Link>
    <PageHeader title="Tạo phiếu xuất" hint="Tạo xong là hoàn tất và trừ tồn kho ngay; phiếu chỉ được tạo một lần. Tìm SKU theo mã, tên sản phẩm hoặc Barcode, mỗi SKU một dòng. Số khả dụng được kiểm tra lại khi lưu." />
    {role && !can("INVENTORY_RECEIPT_CREATE") ? <div className="order-empty"><strong>Chỉ Quản trị viên hoặc Quản lý được tạo phiếu xuất</strong><p>Tài khoản hiện tại chỉ đọc.</p><Link className="secondary" href="/quan-tri/phieu-xuat">Về danh sách</Link></div> : !role ? <p className="meta" role="status">Đang kiểm tra quyền…</p> : (
      <form className="catalog-form rc-form" onSubmit={submit} aria-busy={busy}>
        <div className="form-layout">
          <div className="form-main">
            <section className="form-card">
              <h2>Thông tin</h2>
              <div className="rc-head-fields">
                <div className="catalog-field"><label htmlFor="exp-type">Loại xuất *</label><select id="exp-type" className="catalog-input" value={type} onChange={(e) => { touch(); setType(e.target.value); }}>{TYPE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div className="catalog-field"><label htmlFor="exp-note">Ghi chú</label><input id="exp-note" className="catalog-input" value={note} onChange={(e) => { touch(); setNote(e.target.value); }} /></div>
              </div>
            </section>
            <section className="form-card">
              <h2>Dòng hàng</h2>
              <BarcodeScanInput id="exp-scan" mode="inStock" onScan={scan} />
              <div className="rc-lines">
                <div className="rc-line rc-line-head export" aria-hidden="true"><span>SKU</span><span>SL</span><span>Lý do (tối đa 255 ký tự)</span><span /></div>
                {lines.map((l, index) => { const s = selectedStock(l.key); const er = tried ? lineErrors[l.key] : undefined; return <div className={`rc-line export${hit === l.key ? " s2-hit" : ""}`} data-line-key={l.key} key={l.key} role="group" aria-label={`Dòng ${index + 1}`}>
                  <div className="rc-cell"><span className="rc-cap">SKU</span><SkuPicker id={`exp-sku-${l.key}`} value={l.skuId} mode="inStock" ariaLabel={`SKU dòng ${index + 1}`} onChange={(skuId, stock) => pick(l.key, skuId, stock)} />{er?.sku ? <p className="field-error" role="alert">{er.sku}</p> : s ? null : <small className="meta">Chỉ chọn được SKU còn hàng khả dụng.</small>}</div>
                  <div className="rc-cell"><span className="rc-cap">SL</span><input id={`exp-qty-${l.key}`} className="catalog-input" inputMode="numeric" aria-label={`Số lượng dòng ${index + 1}`} aria-invalid={Boolean(er?.qty)} value={l.quantity} onChange={(e) => update(l.key, "quantity", e.target.value)} />{er?.qty ? <p className="field-error" role="alert">{er.qty}</p> : null}</div>
                  <div className="rc-cell"><span className="rc-cap">Lý do</span><input id={`exp-reason-${l.key}`} className="catalog-input" maxLength={255} aria-label={`Lý do dòng ${index + 1}`} aria-invalid={Boolean(er?.reason)} value={l.reason} onChange={(e) => update(l.key, "reason", e.target.value)} />{er?.reason ? <p className="field-error" role="alert">{er.reason}</p> : null}</div>
                  <button className="icon-btn rc-remove" type="button" aria-label={`Xóa dòng ${index + 1}`} title="Xóa dòng" disabled={lines.length === 1} onClick={() => remove(l.key)}><Icon name="trash-2" size={16} /></button>
                </div>; })}
              </div>
              <div className="catalog-actions"><button className="secondary" type="button" onClick={add}>+ Thêm dòng</button></div>
            </section>
          </div>
          <aside className="form-side">
            <section className="form-card rc-summary">
              <h2>Tóm tắt</h2>
              <dl className="rc-sum">
                <div><dt>Loại xuất</dt><dd>{TYPE.find(([v]) => v === type)?.[1]}</dd></div>
                <div><dt>Số dòng</dt><dd><Num tone="blue" value={lines.length} /></dd></div>
                <div className="rc-sum-total"><dt>Tổng số lượng xuất</dt><dd><Num tone="orange" bold value={totalQty} /></dd></div>
              </dl>
            </section>
          </aside>
        </div>
        {error ? <p className="catalog-error" role="alert">{error}</p> : null}{uncertain ? <p className="catalog-error" role="alert">Không gửi lại tự động. <Link className="text-link" href="/quan-tri/phieu-xuat">Mở danh sách phiếu xuất để đối soát →</Link></p> : null}
        <div className="action-bar"><Link className="secondary" href="/quan-tri/phieu-xuat">Hủy</Link><button className="primary" type="submit" disabled={busy}>{busy ? "Đang tạo phiếu…" : "Tạo phiếu và trừ kho"}</button></div>
      </form>)}
  </AdminShellB>;
}
