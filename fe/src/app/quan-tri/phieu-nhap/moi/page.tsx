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
import { MoneyInput } from "@/components/admin-b/money-input";
import { MONEY_INVALID } from "@/lib/money-input";
import { SkuPicker, skuLabel } from "@/components/admin-b/sku-picker";
import { BarcodeScanInput, type ScanResult } from "@/components/admin-b/barcode-scan-input";
import { createImport, StockError, type Stock } from "@/lib/admin-stock-client";
type Line = { key: number; skuId: string; quantity: string; price: string };
export default function NewImportPage() {
  const role = useAdminRole(); const can = useAdminCan(); const router = useRouter(); const toast = useToast();
  const [supplier, setSupplier] = useState(""); const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>(() => {
    const q = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("sku");
    return [{ key: 1, skuId: q && /^[1-9]\d*$/.test(q) ? q : "", quantity: "1", price: "" }];
  });
  const [serverError, setServerError] = useState(""); const [uncertain, setUncertain] = useState(false); const [busy, setBusy] = useState(false); const [tried, setTried] = useState(false); const busyRef = useRef(false); const nextKey = useRef(2);
  const estimate = lines.reduce((n, l) => { const q = Number(l.quantity); const p = Number(l.price); return n + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0); }, 0);
  const linesRef = useRef(lines); useEffect(() => { linesRef.current = lines; });
  const [hit, setHit] = useState<number | null>(null); const hitTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hitTimer.current), []);
  function flashLine(key: number) { setHit(key); window.clearTimeout(hitTimer.current); hitTimer.current = window.setTimeout(() => setHit(null), 1400); window.requestAnimationFrame(() => document.querySelector(`[data-line-key="${key}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })); }
  // Barcode scanner: add the SKU as a line, or add one to its quantity when it is already a line.
  function scan(stock: Stock): ScanResult {
    touch();
    const id = String(stock.skuId); const cur = linesRef.current; const existing = cur.find((l) => l.skuId === id);
    if (existing) { const q = Number(existing.quantity); const next = (Number.isSafeInteger(q) && q >= 1 ? q : 0) + 1; const out = cur.map((l) => l.key === existing.key ? { ...l, quantity: String(next) } : l); linesRef.current = out; setLines(out); flashLine(existing.key); return { ok: true, message: `${skuLabel(stock)}: số lượng ${next}.` }; }
    const empty = cur.find((l) => l.skuId === "");
    if (empty) { const out = cur.map((l) => l.key === empty.key ? { ...l, skuId: id, quantity: "1" } : l); linesRef.current = out; setLines(out); flashLine(empty.key); }
    else { const key = nextKey.current++; const out = [...cur, { key, skuId: id, quantity: "1", price: "" }]; linesRef.current = out; setLines(out); flashLine(key); }
    return { ok: true, message: `Đã thêm ${skuLabel(stock)}.` };
  }
  function touch() { setServerError(""); setUncertain(false); }
  function update(key: number, field: keyof Line, value: string) { touch(); setLines((ls) => ls.map((l) => l.key === key ? { ...l, [field]: value } : l)); }
  function add() { touch(); const key = nextKey.current++; setLines((ls) => [...ls, { key, skuId: "", quantity: "1", price: "" }]); }
  function remove(key: number) { touch(); setLines((ls) => ls.length === 1 ? ls : ls.filter((l) => l.key !== key)); }
  // Validation is derived from the current values, so an error disappears the moment the field becomes valid.
  const problems = (() => {
    const supplierError = supplier.trim() ? "" : "Nhập tên nhà cung cấp.";
    const lineErrors: Record<number, { sku?: string; qty?: string; price?: string }> = {};
    const seen = new Set<number>();
    for (const l of lines) {
      const e: { sku?: string; qty?: string; price?: string } = {};
      const skuId = Number(l.skuId); const q = Number(l.quantity); const pr = Number(l.price);
      if (!Number.isSafeInteger(skuId) || skuId < 1) e.sku = "Chọn SKU cho dòng này.";
      else if (seen.has(skuId)) e.sku = "SKU này đã có ở dòng khác.";
      else seen.add(skuId);
      if (!Number.isSafeInteger(q) || q < 1) e.qty = "Số nguyên dương.";
      if (l.price === MONEY_INVALID) e.price = "Giá chưa đúng định dạng, ví dụ 1.450.000.";
      else if (!Number.isFinite(pr) || pr <= 0) e.price = "Giá phải lớn hơn 0.";
      if (e.sku || e.qty || e.price) lineErrors[l.key] = e;
    }
    return { supplierError, lineErrors, any: Boolean(supplierError) || Object.keys(lineErrors).length > 0 };
  })();
  const show = tried;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busyRef.current) return;
    if (problems.any) {
      setTried(true);
      const firstKey = lines.find((l) => problems.lineErrors[l.key])?.key;
      const target = problems.supplierError ? "imp-supplier" : firstKey !== undefined ? (problems.lineErrors[firstKey].sku ? `imp-sku-${firstKey}` : problems.lineErrors[firstKey].qty ? `imp-qty-${firstKey}` : `imp-price-${firstKey}`) : "";
      if (target) window.requestAnimationFrame(() => document.getElementById(target)?.focus());
      return;
    }
    const items = lines.map((l) => ({ skuId: Number(l.skuId), quantity: Number(l.quantity), importPrice: Number(l.price) }));
    busyRef.current = true; setBusy(true); setServerError(""); setUncertain(false);
    try {
      const receipt = await createImport({ supplierName: supplier.trim(), note, items });
      toast.success("Đã tạo phiếu nhập kho. Tồn kho đã được cộng.");
      // Stay busy after success: the page is navigating away and a second click must not create another receipt.
      router.push(`/quan-tri/phieu-nhap/${receipt.receiptId}`);
      return;
    } catch (failure) {
      if (failure instanceof StockError) setServerError(failure.message);
      else { setUncertain(true); setServerError("Chưa xác định được phiếu đã được tạo hay chưa. Không gửi lại tự động; mở danh sách phiếu để đối soát."); }
      busyRef.current = false; setBusy(false);
    }
  }
  const pricedLines = lines.filter((l) => Number(l.quantity) > 0 && Number(l.price) > 0).length;
  const totalQty = lines.reduce((n, l) => n + (Number.isFinite(Number(l.quantity)) ? Number(l.quantity) : 0), 0);
  return <AdminShellB active="imports" title="Tạo phiếu nhập">
    <Link className="back-link" href="/quan-tri/phieu-nhap">← Phiếu nhập</Link>
    <PageHeader title="Tạo phiếu nhập" hint="Tạo xong là hoàn tất và cộng tồn kho ngay; số lượng đang giữ không đổi. Tìm SKU theo mã, tên sản phẩm hoặc Barcode, mỗi SKU một dòng. Tổng tiền là tạm tính, số chính thức có sau khi lưu." />
    {role && !can("INVENTORY_RECEIPT_CREATE") ? <div className="order-empty"><strong>Chỉ Quản trị viên hoặc Quản lý được tạo phiếu nhập</strong><p>Tài khoản hiện tại chỉ đọc.</p><Link className="secondary" href="/quan-tri/phieu-nhap">Về danh sách</Link></div> : !role ? <p className="meta" role="status">Đang kiểm tra quyền…</p> : (
      <form className="catalog-form rc-form" onSubmit={submit} aria-busy={busy}>
        <div className="form-layout">
          <div className="form-main">
            <section className="form-card">
              <h2>Thông tin</h2>
              <div className="rc-head-fields">
                <div className="catalog-field"><label htmlFor="imp-supplier">Nhà cung cấp *</label><input id="imp-supplier" className="catalog-input" value={supplier} maxLength={255} aria-invalid={show && Boolean(problems.supplierError)} aria-describedby={show && problems.supplierError ? "imp-supplier-err" : undefined} onChange={(e) => { touch(); setSupplier(e.target.value); }} />{show && problems.supplierError ? <p className="field-error" id="imp-supplier-err" role="alert">{problems.supplierError}</p> : null}</div>
                <div className="catalog-field"><label htmlFor="imp-note">Ghi chú</label><input id="imp-note" className="catalog-input" value={note} onChange={(e) => { touch(); setNote(e.target.value); }} /></div>
              </div>
            </section>
            <section className="form-card">
              <h2>Dòng hàng</h2>
              <BarcodeScanInput id="imp-scan" mode="any" onScan={scan} />
              <div className="rc-lines">
                <div className="rc-line rc-line-head import" aria-hidden="true"><span>SKU</span><span>SL</span><span className="r">Giá nhập</span><span className="r">Thành tiền</span><span /></div>
                {lines.map((l, index) => { const er = show ? problems.lineErrors[l.key] : undefined; return <div className={`rc-line import${hit === l.key ? " s2-hit" : ""}`} data-line-key={l.key} key={l.key} role="group" aria-label={`Dòng ${index + 1}`}>
                  <div className="rc-cell"><span className="rc-cap">SKU</span><SkuPicker id={`imp-sku-${l.key}`} value={l.skuId} mode="any" ariaLabel={`SKU dòng ${index + 1}`} onChange={(skuId) => update(l.key, "skuId", skuId)} />{er?.sku ? <p className="field-error" role="alert">{er.sku}</p> : null}</div>
                  <div className="rc-cell"><span className="rc-cap">SL</span><input id={`imp-qty-${l.key}`} className="catalog-input" inputMode="numeric" aria-label={`Số lượng dòng ${index + 1}`} aria-invalid={Boolean(er?.qty)} value={l.quantity} onChange={(e) => update(l.key, "quantity", e.target.value)} />{er?.qty ? <p className="field-error" role="alert">{er.qty}</p> : null}</div>
                  <div className="rc-cell"><span className="rc-cap">Giá nhập</span><MoneyInput id={`imp-price-${l.key}`} className="catalog-input r" aria-label={`Giá nhập dòng ${index + 1}`} aria-invalid={Boolean(er?.price)} value={l.price} onChange={(v) => update(l.key, "price", v)} placeholder="0" />{er?.price ? <p className="field-error" role="alert">{er.price}</p> : null}</div>
                  <div className="rc-cell rc-total"><span className="rc-cap">Thành tiền</span><span className="line-total"><Num tone="green" bold money value={(Number(l.quantity) || 0) * (Number(l.price) || 0)} /></span></div>
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
                <div><dt>Dòng đã đủ giá</dt><dd><Num tone="blue" value={pricedLines} /></dd></div>
                <div><dt>Tổng số lượng</dt><dd><Num tone="blue" value={totalQty} /></dd></div>
                <div className="rc-sum-total"><dt>Tạm tính</dt><dd><Num tone="green" bold money value={estimate} /></dd></div>
              </dl>
            </section>
          </aside>
        </div>
        {serverError ? <p className="catalog-error" role="alert">{serverError}</p> : null}{uncertain ? <p className="catalog-error" role="alert">Không gửi lại tự động. <Link className="text-link" href="/quan-tri/phieu-nhap">Mở danh sách phiếu để đối soát →</Link></p> : null}
        <div className="action-bar"><Link className="secondary" href="/quan-tri/phieu-nhap">Hủy</Link><button className="primary" type="submit" disabled={busy}>{busy ? "Đang tạo phiếu…" : "Tạo phiếu và cộng kho"}</button></div>
      </form>)}
  </AdminShellB>;
}
