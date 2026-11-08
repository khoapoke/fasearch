"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { PageHeader } from "@/components/admin-b/page-header";
import { Icon } from "@/components/admin-b/icons";
import { SkuPicker } from "@/components/admin-b/sku-picker";
import { TableSkeleton } from "@/components/admin-b/skeleton";
import { InfoHint } from "@/components/admin-b/info-hint";
import { Num } from "@/components/admin-b/status-badge";
import { useToast } from "@/components/admin-b/toast";
import { LABEL_SIZES, LabelPages, MIN_MODULE_MM, formatLabelPrice, moduleWidthMm, paginate, type LabelCell, type LabelSizeKey } from "@/components/admin-b/barcode-label";
import { encodeBarcode } from "@/lib/barcode";
import { loadLabelItem, parseItemsParam, type LabelItem } from "@/lib/admin-label-client";

type Row = { skuId: number; qty: string; item?: LabelItem; error?: string };
const MAX_LABELS = 600;
const PREVIEW_CELLS = 24;
const SIZE_KEY = "fasearch-label-size";

const qtyOf = (r: Row) => (/^\d{1,3}$/.test(r.qty) ? Number(r.qty) : 0);

export default function LabelPrintPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState<LabelSizeKey>("r35");
  const [startCell, setStartCell] = useState("1");
  const [from, setFrom] = useState("");
  const [pickKey, setPickKey] = useState(0);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(async (skuIds: number[]) => {
    const c = abort.current ?? new AbortController();
    abort.current = c;
    let i = 0;
    const worker = async () => {
      while (i < skuIds.length) {
        const id = skuIds[i++];
        try {
          const item = await loadLabelItem(id, c.signal);
          setRows((rs) => rs.map((r) => (r.skuId === id ? { ...r, item, error: undefined } : r)));
        } catch (e) {
          if (c.signal.aborted) return;
          const msg = e instanceof Error ? e.message : "Không đọc được SKU.";
          setRows((rs) => rs.map((r) => (r.skuId === id ? { ...r, error: msg } : r)));
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }, []);

  useEffect(() => {
    let alive = true;
    // Read the URL after mount (client only), outside the effect body so state updates are not synchronous.
    void Promise.resolve().then(() => {
      if (!alive) return;
      const params = new URLSearchParams(window.location.search);
      const parsed = parseItemsParam(params.get("items"));
      setFrom(params.get("from") ?? "");
      try { const s = window.localStorage.getItem(SIZE_KEY); if (s === "r35" || s === "r50" || s === "a4") setSize(s); } catch {}
      let root = document.getElementById("s2-print-root");
      if (!root) { root = document.createElement("div"); root.id = "s2-print-root"; document.body.appendChild(root); }
      setPortal(root);
      setRows(parsed.map((p) => ({ skuId: p.skuId, qty: String(p.qty) })));
      if (parsed.length === 0) setLoading(false);
      else void load(parsed.map((p) => p.skuId)).finally(() => setLoading(false));
    });
    return () => { alive = false; abort.current?.abort(); abort.current = null; document.getElementById("s2-print-root")?.remove(); };
  }, [load]);

  function chooseSize(k: LabelSizeKey) { setSize(k); try { window.localStorage.setItem(SIZE_KEY, k); } catch {} }
  function setQty(skuId: number, qty: string) { setRows((rs) => rs.map((r) => (r.skuId === skuId ? { ...r, qty: qty.replace(/\D/g, "").slice(0, 3) } : r))); }
  function remove(skuId: number) { setRows((rs) => rs.filter((r) => r.skuId !== skuId)); }
  function addSku(skuId: string) {
    const id = Number(skuId);
    if (!Number.isSafeInteger(id) || id < 1) return;
    setPickKey((k) => k + 1);
    if (rows.some((r) => r.skuId === id)) { setRows((rs) => rs.map((r) => (r.skuId === id ? { ...r, qty: String(Math.min(999, (qtyOf(r) || 0) + 1)) } : r))); toast.success("SKU đã có trong danh sách, tăng số tem thêm 1."); return; }
    setRows((rs) => [...rs, { skuId: id, qty: "1" }]);
    void load([id]);
  }

  const cfg = LABEL_SIZES[size];
  const ready = rows.filter((r) => r.item && qtyOf(r) > 0);
  const total = ready.reduce((n, r) => n + qtyOf(r), 0);
  const start = size === "a4" ? Math.min(24, Math.max(1, Number(startCell) || 1)) : 1;

  const cells = useMemo<LabelCell[]>(() => {
    const out: LabelCell[] = size === "a4" ? new Array(start - 1).fill(null) : [];
    for (const r of ready) for (let i = 0; i < qtyOf(r); i++) out.push(r.item as LabelItem);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, size, start]);
  const pages = useMemo(() => paginate(cells, cfg), [cells, cfg]);
  const previewPages = useMemo(() => paginate(cells.slice(0, PREVIEW_CELLS), cfg).slice(0, 1), [cells, cfg]);

  const tooMany = total > MAX_LABELS;
  const anyLoading = rows.some((r) => !r.item && !r.error);
  const canPrint = ready.length > 0 && !tooMany && !anyLoading;
  const narrow = (r: Row) => { const b = r.item ? encodeBarcode(r.item.barcode) : null; return b ? moduleWidthMm(b, cfg) < MIN_MODULE_MM : false; };
  const narrowCount = ready.filter(narrow).length;

  return <AdminShellB active="products" title="In tem Barcode">
    <Link className="back-link" href="/quan-tri/san-pham">← Sản phẩm</Link>
    <PageHeader title="In tem Barcode" hint="Chọn SKU và số tem, chọn khổ tem rồi in. Barcode dùng chuẩn EAN-13 khi mã là 13 chữ số hợp lệ, còn lại dùng Code128. Máy in cần để tỉ lệ 100%, tắt Fit to page." actions={<button className="primary" type="button" disabled={!canPrint} onClick={() => window.print()}>In {total > 0 ? `${total} tem` : "tem"}</button>} />
    <div className="s2-layout">
      <div className="s2-main">
        <section className="form-card">
          <h2>Danh sách tem{from ? <small className="meta"> · từ phiếu nhập {from}</small> : null}</h2>
          <div className="s2-addrow">
            <SkuPicker key={pickKey} id="label-add-sku" value="" mode="any" ariaLabel="Thêm SKU để in tem" placeholder="Thêm SKU: gõ SKU, tên sản phẩm hoặc Barcode…" onChange={(id) => addSku(id)} />
          </div>
          {loading ? <TableSkeleton rows={4} columns={5} /> : rows.length === 0 ? <div className="order-empty"><strong>Chưa có SKU để in</strong><p>Thêm SKU ở trên, hoặc bấm In tem trong trang sản phẩm hoặc phiếu nhập.</p></div> : (
            <div className="table-scroll sticky-head review-table-scroll" tabIndex={0} aria-label="SKU cần in tem">
              <table className="review-orders-table s2-lines">
                <caption className="sr-only">SKU và số tem cần in</caption>
                <thead><tr><th>Sản phẩm</th><th>Barcode</th><th className="num">Giá</th><th className="num">Số tem</th><th aria-label="Xóa" /></tr></thead>
                <tbody>{rows.map((r) => <tr key={r.skuId} className={r.error ? "s2-row-err" : undefined}>
                  <td className="cell-title">{r.item ? <><span className="st-name">{r.item.productName}</span><small className="meta">SKU {r.skuId}{[r.item.color, r.item.size].filter(Boolean).length ? ` · ${[r.item.color, r.item.size].filter(Boolean).join(" / ")}` : ""}</small></> : <span>SKU {r.skuId}{r.error ? ` · ${r.error}` : " · đang tải…"}</span>}</td>
                  <td className="s2-code-cell">{r.item ? <>{r.item.barcode}{narrow(r) ? <span className="s2-warn" title="Mã dài so với khổ tem, có thể khó quét. Chọn tem lớn hơn."><Icon name="circle-alert" size={14} />Mã dài</span> : null}</> : null}</td>
                  <td className="num">{r.item ? formatLabelPrice(r.item.price) : null}</td>
                  <td className="num"><input className="catalog-input s2-qty" inputMode="numeric" aria-label={`Số tem SKU ${r.skuId}`} value={r.qty} onChange={(e) => setQty(r.skuId, e.target.value)} onBlur={() => { if (!qtyOf(r)) setQty(r.skuId, "1"); }} /></td>
                  <td className="num"><button className="icon-btn" type="button" aria-label={`Xóa SKU ${r.skuId} khỏi danh sách`} title="Xóa" onClick={() => remove(r.skuId)}><Icon name="trash-2" size={16} /></button></td>
                </tr>)}</tbody>
              </table>
            </div>)}
          {tooMany ? <p className="catalog-error" role="alert">Tối đa {MAX_LABELS} tem mỗi lần in. Giảm số tem hoặc in làm nhiều lần.</p> : null}
        </section>
      </div>
      <aside className="s2-side">
        <section className="form-card">
          <h2>Khổ tem <InfoHint>Tem cuộn in nguyên khổ, mỗi hàng một trang. Tem A4 3 × 8 là 70 × 37 mm, không lề.</InfoHint></h2>
          <div className="s2-sizes" role="radiogroup" aria-label="Khổ tem">
            {Object.values(LABEL_SIZES).map((s) => <label key={s.key} className="s2-size"><input type="radio" name="label-size" checked={size === s.key} onChange={() => chooseSize(s.key)} /><span><strong>{s.name}</strong><small>{s.detail}</small></span></label>)}
          </div>
          {size === "a4" ? <div className="catalog-field" style={{ marginTop: "var(--s-3)" }}><label htmlFor="label-start">Bắt đầu từ ô số (1–24)</label><input id="label-start" className="catalog-input" inputMode="numeric" value={startCell} onChange={(e) => setStartCell(e.target.value.replace(/\D/g, "").slice(0, 2))} /></div> : null}
        </section>
        <section className="form-card">
          <h2>Xem trước</h2>
          <div className="s2-stats"><span>Tổng số tem</span><Num tone="blue" bold value={total} /></div>
          {narrowCount > 0 ? <p className="s2-warn" role="status"><Icon name="circle-alert" size={14} />{narrowCount} SKU có mã dài so với khổ này, có thể khó quét.</p> : null}
          <div className="s2-preview-box" aria-label="Xem trước tem">
            {previewPages.length > 0 && previewPages[0].length > 0 ? <div className={`s2-preview-scale s2-${size}-scale`}><LabelPages pages={previewPages} size={cfg} /></div> : <p className="meta">Chưa có tem để xem trước.</p>}
          </div>
          {cells.length > PREVIEW_CELLS ? <p className="meta">Hiển thị {PREVIEW_CELLS} tem đầu trong {cells.length}.</p> : null}
          <p className="s2-print-note">Khi in chọn Scale 100%, tắt Fit to page.</p>
        </section>
      </aside>
    </div>
    {portal && canPrint ? createPortal(<><style>{`@page{size:${cfg.pageW}mm ${size === "a4" ? "297mm" : `${cfg.pageH}mm`};margin:0}`}</style><LabelPages pages={pages} size={cfg} /></>, portal) : null}
  </AdminShellB>;
}
