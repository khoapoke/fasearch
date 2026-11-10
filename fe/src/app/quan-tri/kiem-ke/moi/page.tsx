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
import type { Stock } from "@/lib/admin-stock-client";
import { createStocktake, StocktakeError } from "@/lib/admin-stocktake-client";
type Line = { key: number; skuId: string; actualCount: string };
const MAX_COUNT = 1_000_000;
export default function NewStocktakePage() {
  const role = useAdminRole(); const can = useAdminCan(); const router = useRouter(); const toast = useToast();
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([{ key: 1, skuId: "", actualCount: "0" }]);
  const [picked, setPicked] = useState<Record<number, Stock | null>>({});
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); const nextKey = useRef(2);
  function focus(id: string) { window.requestAnimationFrame(() => document.getElementById(id)?.focus()); }
  const linesRef = useRef(lines); useEffect(() => { linesRef.current = lines; });
  const [hit, setHit] = useState<number | null>(null); const hitTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hitTimer.current), []);
  function flashLine(key: number) { setHit(key); window.clearTimeout(hitTimer.current); hitTimer.current = window.setTimeout(() => setHit(null), 1400); window.requestAnimationFrame(() => document.querySelector(`[data-line-key="${key}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })); }
  // Barcode scanner: every scan counts one unit. A new SKU starts at 1, a known SKU goes up by 1.
  function scan(stock: Stock): ScanResult {
    touch();
    const id = String(stock.skuId); const cur = linesRef.current; const existing = cur.find((l) => l.skuId === id);
    if (existing) {
      const q = /^\d+$/.test(existing.actualCount) ? Number(existing.actualCount) : 0; const next = q + 1;
      if (next > MAX_COUNT) return { ok: false, message: `${skuLabel(stock)}: tối đa ${MAX_COUNT.toLocaleString("vi-VN")}.` };
      const out = cur.map((l) => l.key === existing.key ? { ...l, actualCount: String(next) } : l); linesRef.current = out; setLines(out); setPicked((m) => ({ ...m, [existing.key]: stock })); flashLine(existing.key);
      return { ok: true, message: `${skuLabel(stock)}: đếm ${next}.` };
    }
    const blank = cur.find((l) => l.skuId === ""); let key: number;
    if (blank) { key = blank.key; const out = cur.map((l) => l.key === key ? { ...l, skuId: id, actualCount: "1" } : l); linesRef.current = out; setLines(out); }
    else { key = nextKey.current++; const out = [...cur, { key, skuId: id, actualCount: "1" }]; linesRef.current = out; setLines(out); }
    setPicked((m) => ({ ...m, [key]: stock })); flashLine(key);
    return { ok: true, message: `Đã thêm ${skuLabel(stock)}.` };
  }
  function touch() { setError(""); setUncertain(false); }
  function update(key: number, field: keyof Line, value: string) { touch(); setLines((ls) => ls.map((l) => l.key === key ? { ...l, [field]: value } : l)); }
  function pick(key: number, skuId: string, stock: Stock | null) { update(key, "skuId", skuId); setPicked((m) => ({ ...m, [key]: stock })); }
  function add() { touch(); const key = nextKey.current++; setLines((ls) => [...ls, { key, skuId: "", actualCount: "0" }]); }
  function remove(key: number) { touch(); setLines((ls) => ls.length === 1 ? ls : ls.filter((l) => l.key !== key)); setPicked((m) => { const n = { ...m }; delete n[key]; return n; }); }
  const selectedStock = (key: number) => picked[key] ?? null;
  // Derived from current values: an error disappears as soon as the field is valid.
  const noteError = note.length > 1000 ? "Ghi chú tối đa 1000 ký tự." : "";
  const lineErrors: Record<number, { sku?: string; count?: string }> = {};
  { const seen = new Set<number>();
    for (const l of lines) {
      const e: { sku?: string; count?: string } = {}; const skuId = Number(l.skuId);
      if (!l.skuId || !Number.isSafeInteger(skuId) || skuId < 1) e.sku = "Chọn SKU cho dòng này.";
      else if (seen.has(skuId)) e.sku = "SKU này đã có ở dòng khác.";
      else seen.add(skuId);
      if (!/^\d+$/.test(l.actualCount)) e.count = "Số nguyên không âm.";
      else if (Number(l.actualCount) > MAX_COUNT) e.count = "Từ 0 đến 1.000.000.";
      if (e.sku || e.count) lineErrors[l.key] = e;
    } }
  const hasProblems = Boolean(noteError) || Object.keys(lineErrors).length > 0;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busyRef.current) return;
    if (hasProblems) {
      setTried(true);
      const first = lines.find((l) => lineErrors[l.key]); const er = first ? lineErrors[first.key] : undefined;
      const target = noteError ? "st-note" : first && er ? (er.sku ? `st-sku-${first.key}` : `st-actual-${first.key}`) : "";
      if (target) focus(target);
      return;
    }
    const records = lines.map((l) => ({ skuId: Number(l.skuId), actualCount: Number(l.actualCount) }));
    busyRef.current = true; setBusy(true); setError(""); setUncertain(false);
    try { const saved = await createStocktake({ note, records }); toast.success("Đã ghi nhận phiếu kiểm kê."); router.push(`/quan-tri/kiem-ke/${saved.stocktakeId}`); return; }
    catch (failure) {
      if (failure instanceof StocktakeError) setError(failure.message);
      else { setUncertain(true); setError("Chưa xác định được phiếu đã được ghi nhận hay chưa. Không gửi lại tự động; mở danh sách kiểm kê để đối soát."); }
      busyRef.current = false; setBusy(false);
    }
  }
  const canWrite = can("STOCKTAKE_CREATE");
  const totalDiff = lines.reduce((n, l) => { const s = picked[l.key]; const a = /^\d+$/.test(l.actualCount) ? Number(l.actualCount) : null; return s && s.physicalStock !== null && a !== null ? n + Math.abs(a - s.physicalStock) : n; }, 0);
  return <AdminShellB active="stocktakes" title="Tạo phiếu kiểm kê">
    <Link className="back-link" href="/quan-tri/kiem-ke">← Kiểm kê</Link>
    <PageHeader title="Tạo phiếu kiểm kê" hint="Ghi nhận số đếm thực tế; phiếu không trừ hoặc cộng tồn kho. Kiểm kê chọn được cả SKU tồn 0, mỗi SKU chỉ nhập một lần. Hệ thống chốt số lệch khi lưu." />
    {role && !canWrite ? <div className="order-empty"><strong>Chỉ Quản trị viên hoặc Quản lý được tạo phiếu kiểm kê</strong><p>Tài khoản hiện tại không có quyền ghi nhận.</p><Link className="secondary" href="/quan-tri/kiem-ke">Về danh sách</Link></div> : !role ? <p className="meta" role="status">Đang kiểm tra quyền…</p> : (
      <form className="catalog-form stocktake-form rc-form" onSubmit={submit} aria-busy={busy}>
        <div className="form-layout">
          <div className="form-main">
            <section className="form-card">
              <h2>Ghi chú</h2>
              <div className="catalog-field"><label htmlFor="st-note">Ghi chú (tối đa 1.000 ký tự)</label><textarea id="st-note" className="catalog-input stocktake-note-input" maxLength={1000} value={note} aria-invalid={tried && Boolean(noteError)} onChange={(e) => { touch(); setNote(e.target.value); }} rows={2} />{tried && noteError ? <p className="field-error" role="alert">{noteError}</p> : null}</div>
            </section>
            <section className="form-card">
              <h2>Dòng kiểm kê</h2>
              <BarcodeScanInput id="st-scan" mode="any" onScan={scan} />
              <div className="rc-lines">
                <div className="rc-line rc-line-head stocktake" aria-hidden="true"><span>SKU</span><span>Đếm thực tế</span><span className="r">Lệch tạm tính</span><span /></div>
                {lines.map((l, index) => { const s = selectedStock(l.key); const er = tried ? lineErrors[l.key] : undefined; const actual = /^\d+$/.test(l.actualCount) ? Number(l.actualCount) : null; const system = s?.physicalStock ?? null; const diff = actual !== null && system !== null ? actual - system : null; return <div className={`rc-line stocktake${hit === l.key ? " s2-hit" : ""}`} data-line-key={l.key} key={l.key} role="group" aria-label={`Dòng ${index + 1}`}>
                  <div className="rc-cell"><span className="rc-cap">SKU</span><SkuPicker id={`st-sku-${l.key}`} value={l.skuId} mode="any" ariaLabel={`SKU dòng ${index + 1}`} onChange={(skuId, stock) => pick(l.key, skuId, stock)} />{er?.sku ? <p className="field-error" role="alert">{er.sku}</p> : s ? null : <small className="meta">Gõ để tìm trong toàn bộ sản phẩm.</small>}</div>
                  <div className="rc-cell"><span className="rc-cap">Đếm thực tế</span><input id={`st-actual-${l.key}`} className="catalog-input" inputMode="numeric" maxLength={7} aria-label={`Đếm thực tế dòng ${index + 1}`} aria-invalid={Boolean(er?.count)} value={l.actualCount} onChange={(e) => update(l.key, "actualCount", e.target.value)} />{er?.count ? <p className="field-error" role="alert">{er.count}</p> : null}</div>
                  <div className="rc-cell rc-total"><span className="rc-cap">Lệch tạm tính</span><span className="line-total">{diff === null ? <span className="meta">Chưa có</span> : <Num tone="delta" signed bold value={diff} />}</span></div>
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
                <div><dt>Số dòng</dt><dd><Num tone="blue" value={lines.length} /></dd></div>
                <div className="rc-sum-total"><dt>Tổng lệch tạm tính</dt><dd><Num tone="amber" bold value={totalDiff} /></dd></div>
              </dl>
            </section>
          </aside>
        </div>
        {error ? <p className="catalog-error" role="alert">{error}</p> : null}{uncertain ? <p className="catalog-error" role="alert">Không gửi lại tự động. <Link className="text-link" href="/quan-tri/kiem-ke">Mở danh sách kiểm kê để đối soát →</Link></p> : null}
        <div className="action-bar"><Link className="secondary" href="/quan-tri/kiem-ke">Hủy</Link><button className="primary" type="submit" disabled={busy}>{busy ? "Đang ghi nhận…" : "Ghi nhận phiếu kiểm kê"}</button></div>
      </form>)}
  </AdminShellB>;
}
