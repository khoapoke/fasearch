"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { AdminShellB } from "./admin-shell";

type Counts = Record<string, number>;
type QueueOrder = { orderId: number; orderCode: string; status: string; customerName: string | null; totalAmount: number; createdAt: string };
type Group = { total: number; rows: QueueOrder[] };
type Overview = { role: "ADMIN" | "STAFF"; counts: Counts; queueTotal: number; groups: Record<string, Group>; fetchedAt: string };
type RevenuePoint = { date: string; revenue: number; orders: number };
type RevenueResult = { summary: { totalRevenue: number; totalOrders: number; averageOrderValue: number; totalCogs: number | null; grossProfit: number | null }; timeline: RevenuePoint[] };
type StockException = { skuId: number; productId: number; productName: string; color: string | null; size: string | null; barcode: string | null; physicalStock: number; reservedStock: number; availableStock: number; minThreshold: number };
type StockSummary = { totalSkus: number; outOfStock: number; lowStock: number; healthyStock: number; physicalTotal: number; reservedTotal: number; availableTotal: number; exceptionsTotal: number; limit: number; exceptions: StockException[] };
const STAGES = [
  { code: "PENDING", label: "Mới tạo", lower: "mới tạo" },
  { code: "CONFIRMED", label: "Đã xác nhận", lower: "đã xác nhận" },
  { code: "PACKING", label: "Đang đóng gói", lower: "đang đóng gói" },
];
const STATUS_LABEL: Record<string, string> = { PENDING: "Mới tạo", CONFIRMED: "Đã xác nhận", PACKING: "Đang đóng gói", SHIPPING: "Đang giao", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy", RETURNED: "Đã trả lại" };
// Múi giờ hiển thị/kỳ báo cáo: Asia/Ho_Chi_Minh (ngày YYYY-MM-DD theo lịch Việt Nam).
function todayLocal(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return parts;
}
function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00+07:00`); d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function rangeText(start: string, end: string) { return `${dayText(start)} – ${dayText(end)}`; }
function amount(v: number) { return v.toLocaleString("vi-VN"); }
function Money({ v }: { v: number }) { return <span className="money">{amount(v)}<span className="unit">VND</span></span>; }
function dayText(v: string) {
  // YYYY-MM-DD (ngày kỳ) hoặc ISO đầy đủ (createdAt từ BE) — không bao giờ trả ISO thô.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(v);
  const d = dateOnly ? new Date(`${v}T00:00:00+07:00`) : new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const f = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" });
  return dateOnly ? f.format(d) : `${f.format(d)} ${new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).format(d)}`;
}
async function fetchRevenue(startDate: string, endDate: string): Promise<RevenueResult> {
  const q = new URLSearchParams({ period: "DAY", startDate, endDate, channel: "ALL" });
  const r = await fetch(`/api/admin/reports/revenue?${q}`, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok || !j.success) throw new Error(j.message || "Không tải được doanh thu.");
  const s = j.result.summary ?? {}, t = Array.isArray(j.result.timeline) ? j.result.timeline : [];
  return { summary: { totalRevenue: Number(s.totalRevenue ?? 0), totalOrders: Number(s.totalOrders ?? 0), averageOrderValue: Number(s.averageOrderValue ?? 0), totalCogs: s.totalCogs ?? null, grossProfit: s.grossProfit ?? s.totalGrossProfit ?? null }, timeline: t.map((p: RevenuePoint) => ({ date: String(p.date), revenue: Number(p.revenue ?? 0), orders: Number(p.orders ?? 0) })) };
}
function Chart({ current, previous, maxLabel }: { current: RevenuePoint[]; previous: RevenuePoint[]; maxLabel: string }) {
  const expanded = false;
  const w = 300, h = 200;
  const margin = { left: 34, right: 10, top: 10, bottom: 26 };
  const pw = w - margin.left - margin.right, ph = h - margin.top - margin.bottom;
  const n = Math.max(current.length, previous.length, 1);
  const peak = Math.max(0, ...current.map((p) => p.revenue), ...previous.map((p) => p.revenue));
  const max = peak <= 0 ? 1 : Math.ceil(peak * 1.1 / 1000000) * 1000000;
  const x = (i: number) => margin.left + (n === 1 ? pw / 2 : pw * i / (n - 1));
  const y = (v: number) => margin.top + ph * (1 - v / max);
  const points = (rows: RevenuePoint[]) => rows.map((d, i) => `${x(i).toFixed(2)},${y(d.revenue).toFixed(2)}`).join(" ");
  const ticks = [0, max / 2, max];
  const idx = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <figure className="chart chart-compact">
      <div className="chart-frame" data-chart="compact">
        <svg role="img" viewBox={`0 0 ${w} ${h}`} aria-label={`Doanh thu theo ngày, thang 0 đến ${maxLabel}`}>
          <title>Doanh thu theo ngày</title>
          <g className="chart-grid">{ticks.map((v) => <g key={String(v)}><line x1={margin.left} x2={w - margin.right} y1={y(v)} y2={y(v)} /><text x={margin.left - 9} y={y(v) + 4} textAnchor="end">{v >= 1000000 ? `${v / 1000000} tr` : String(Math.round(v))}</text></g>)}</g>
          {previous.length > 0 ? <polyline className="previous-line" points={points(previous)} /> : null}
          {current.length > 0 ? <polyline className="current-line" points={points(current)} /> : null}
          {current.length > 0 ? <circle className="last-dot" cx={x(current.length - 1)} cy={y(current[current.length - 1].revenue)} r="3.5" /> : null}
          <g className="chart-axis">{idx.map((i) => current[i] ? <text key={i} x={x(i)} y={h - 9} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{dayText(current[i].date).slice(0, 5)}</text> : null)}</g>
        </svg>
      </div>
    </figure>
  );
}
function FinanceLive({ start, end }: { start: string; end: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const chartButtonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState<RevenueResult | null>(null);
  const [prev, setPrev] = useState<RevenueResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setLoading(true); setError("");
    const len = Math.round((new Date(`${end}T00:00:00+07:00`).getTime() - new Date(`${start}T00:00:00+07:00`).getTime()) / 86400000) + 1;
    const prevEnd = shift(start, -1), prevStart = shift(start, -len);
    Promise.all([fetchRevenue(start, end), fetchRevenue(prevStart, prevEnd)])
      .then(([a, b]) => { if (!c.signal.aborted) { setCur(a); setPrev(b); } })
      .catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được doanh thu."); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [start, end]);
  const show = () => { dialogRef.current?.showModal(); setOpen(true); };
  const close = () => { dialogRef.current?.close(); setOpen(false); };
  useEffect(() => {
    const d = dialogRef.current; if (!d) return;
    const onClose = () => { setOpen(false); chartButtonRef.current?.focus(); };
    d.addEventListener("close", onClose); return () => d.removeEventListener("close", onClose);
  }, []);
  if (loading) return <aside className="finance-desk" aria-labelledby="finance-title"><p className="section-label">Kinh doanh · LIVE</p><p className="meta" role="status">Đang tải doanh thu…</p></aside>;
  if (error || !cur || !prev) return <aside className="finance-desk" aria-labelledby="finance-title"><p className="section-label">Kinh doanh · LIVE</p><div className="order-empty" role="alert"><strong>Không tải được doanh thu</strong><p>{error}</p></div></aside>;
  const growth = prev.summary.totalRevenue > 0 ? ((cur.summary.totalRevenue - prev.summary.totalRevenue) / prev.summary.totalRevenue) * 100 : null;
  const peak = cur.timeline.reduce<RevenuePoint | null>((best, p) => (!best || p.revenue > best.revenue ? p : best), null);
  const last = cur.timeline[cur.timeline.length - 1] ?? null;
  const prevLen = prev.timeline.length, curLen = cur.timeline.length, rows = Math.max(curLen, prevLen);
  const maxLabel = `${Math.ceil(Math.max(0, ...cur.timeline.map((p) => p.revenue)) * 1.1 / 1000000) * 1000000 / 1000000} triệu VND`;
  return (
    <aside className="finance-desk" aria-labelledby="finance-title">
      <p className="section-label">Kinh doanh · LIVE</p>
      <h2 className="metric-label" id="finance-title">Doanh thu {curLen} ngày</h2>
      <div className="revenue">{amount(cur.summary.totalRevenue)}<span className="unit">VND</span></div>
      <p className="meta period">{rangeText(start, end)} · {cur.summary.totalOrders} hóa đơn đã thanh toán · AOV {amount(Math.round(cur.summary.averageOrderValue))} VND</p>
      <div className="comparison">{growth === null ? <span>kỳ trước chưa có doanh thu · không tính tăng trưởng</span> : <span><span className="trend"><Icon name="arrow-up-right" />{growth >= 0 ? "+" : ""}{growth.toFixed(1)}%</span><span>so với kỳ trước <b>{amount(prev.summary.totalRevenue)} VND</b></span></span>}</div>
      <p className="meta preview-mark">Kỳ trước: {rangeText(shift(start, -Math.max(rows, 1)), shift(start, -1))} · cùng độ dài · kênh ALL</p>
      <div className="chart-heading"><h3>Doanh thu theo ngày</h3></div>
      {curLen === 0 ? <p className="meta">Chưa đủ dữ liệu trong kỳ đã chọn.</p> : <Chart current={cur.timeline} previous={prev.timeline} maxLabel={maxLabel} />}
      <button ref={chartButtonRef} className="chart-open" type="button" onClick={show} aria-haspopup="dialog" aria-controls="chart-dialog" aria-expanded={open}><Icon name="chart-no-axes-combined" />Xem biểu đồ lớn</button>
      {peak ? <p className="peak meta">Đỉnh kỳ: <b><Money v={peak.revenue} /></b> · {dayText(peak.date)}</p> : null}
      {last ? <div className="today"><div><span className="meta">Cuối kỳ · {dayText(last.date)}</span><strong><Money v={last.revenue} /></strong></div><span className="bill-count">{last.orders} hóa đơn</span></div> : null}
      <details className="cost"><summary><Icon name="triangle-alert" /><span><strong>Chưa đủ dữ liệu giá vốn</strong><small>BE không có lịch sử giá vốn</small></span><Icon name="chevron-down" /></summary><div className="cost-body"><p>Giá vốn (COGS) và lãi gộp là <b>null</b> trên mọi kỳ · không được coi là 0. Mở rộng chi tiết theo ngày nằm trong bảng bên dưới.</p></div></details>
      <dialog ref={dialogRef} id="chart-dialog" aria-labelledby="chart-dialog-title">
        <div className="dialog-head"><h2 id="chart-dialog-title" tabIndex={-1}>Doanh thu theo ngày</h2><button className="icon-btn" type="button" aria-label="Đóng biểu đồ lớn" onClick={close}><Icon name="x" /></button></div>
        <p className="dialog-meta">{rangeText(start, end)} so với kỳ trước cùng độ dài · kênh ALL</p>
        {curLen === 0 ? <p className="meta">Chưa đủ dữ liệu trong kỳ đã chọn.</p> : <Chart current={cur.timeline} previous={prev.timeline} maxLabel={maxLabel} />}
        <p className="dialog-note">Bảng số liệu đầy đủ nằm bên dưới Overview.</p>
      </dialog>
      <details className="paired-data"><summary><Icon name="table-2" /><span>Bảng số liệu hai kỳ · {rows} ngày</span><Icon name="chevron-down" /></summary><div className="table-scroll" tabIndex={0} aria-label="Bảng doanh thu hai kỳ"><table><caption>Doanh thu live kỳ {rangeText(start, end)} và kỳ trước cùng độ dài · VND · giá vốn null trên mọi dòng.</caption><thead><tr><th>Ngày kỳ này</th><th className="num">Doanh thu</th><th className="num">Hóa đơn</th><th>Giá vốn kỳ này</th><th>Ngày kỳ trước</th><th className="num">Doanh thu kỳ trước</th><th>Giá vốn kỳ trước</th></tr></thead><tbody>{Array.from({ length: rows }, (_, i) => { const a = cur.timeline[i] ?? null, b = prev.timeline[i] ?? null; return <tr key={a?.date ?? `cur-${i}`}><td>{a ? dayText(a.date) : "—"}</td><td className="num">{a ? amount(a.revenue) : "—"}</td><td className="num">{a ? a.orders : "—"}</td><td>Chưa đủ dữ liệu</td><td>{b ? dayText(b.date) : "—"}</td><td className="num">{b ? amount(b.revenue) : "—"}</td><td>Chưa đủ dữ liệu</td></tr>; })}</tbody></table></div></details>
    </aside>
  );
}
function InventoryLive() {
  const [data, setData] = useState<StockSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/admin/stock-summary?limit=20", { cache: "no-store", signal: c.signal }).then(async (r) => { const j = await r.json(); if (!r.ok || !j.success) throw new Error(j.message || "Không tải được tồn kho."); return j.result as StockSummary; }).then((s) => { if (!c.signal.aborted) setData(s); }).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được tồn kho."); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, []);
  return <section className="inventory" aria-labelledby="stock-title"><div className="section-head"><div><h2 id="stock-title">Tồn kho cần chú ý</h2><p className="meta">LIVE · toàn danh mục {data ? `${amount(data.totalSkus)} SKU` : "…"}</p></div>{data ? <p className="exception-label"><Icon name="triangle-alert" />{amount(data.outOfStock)} hết hàng · {amount(data.lowStock)} sắp hết · {amount(data.healthyStock)} ổn định</p> : null}</div>
    {loading ? <p className="meta" role="status">Đang tải tồn kho…</p> : null}
    {error ? <div className="order-empty" role="alert"><strong>Không tải được tồn kho</strong><p>{error}</p></div> : null}
    {data ? <><div className="table-scroll" tabIndex={0} aria-label="Danh sách tồn kho cần chú ý"><table><caption>Live từ hợp đồng tồn kho · tối đa {data.limit} dòng ưu tiên tồn thấp nhất · tổng {amount(data.exceptionsTotal)} ngoại lệ.</caption><thead><tr><th>SKU / Sản phẩm</th><th className="num">Tồn hiện tại</th><th className="num">Đang giữ</th><th className="num">Ngưỡng SKU</th><th>Trạng thái</th></tr></thead><tbody>{data.exceptions.map((r) => { const out = r.availableStock <= 0; return <tr key={r.skuId}><td><strong className="sku">#{r.skuId}</strong><small className="product-name">{r.productName}{r.color ? ` · ${r.color}` : ""}{r.size ? ` · ${r.size}` : ""}</small></td><td className={`num stock-number${out ? " zero" : ""}`}>{r.availableStock}</td><td className="num">{r.reservedStock}</td><td className="num">{r.minThreshold}</td><td><span className={`badge ${out ? "out" : "low"}`}>{out ? "Hết hàng" : "Sắp hết"}</span></td></tr>; })}</tbody></table></div><p className="meta">Ngưỡng là giá trị tồn tại của từng SKU (minThreshold) · hợp đồng không có danh tính kho và không có ngưỡng toàn cục · <Link className="text-link" href="/quan-tri/ton-kho">Xem danh sách tồn kho</Link></p></> : null}
  </section>;
}
export function OverviewClient() {
  const [data, setData] = useState<Overview | null>(null);
  const [stage, setStage] = useState("PENDING");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [end, setEnd] = useState(todayLocal());
  const [start, setStart] = useState(() => shift(todayLocal(), -2));
  const [applied, setApplied] = useState(() => ({ start: shift(todayLocal(), -2), end: todayLocal() }));
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/admin/overview", { cache: "no-store", signal: c.signal }).then(async (r) => { const j = await r.json(); if (!r.ok || !j.success) throw new Error(j.message || "Không tải được tổng quan."); return j.result as Overview; }).then(setData).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được tổng quan."); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, []);
  const admin = data?.role === "ADMIN";
  const counts = data?.counts ?? {};
  const group = data?.groups?.[stage] ?? { total: 0, rows: [] };
  const queue = group.rows;
  const freshness = data?.fetchedAt ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" }).format(new Date(data.fetchedAt)) : null;
  const selectStage = (next: string) => {
    setStage(next);
    requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
  };
  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? STAGES.length - 1 : event.key === "ArrowRight" ? (index + 1) % STAGES.length : (index - 1 + STAGES.length) % STAGES.length;
    selectStage(STAGES[next].code);
  };
  const applyRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) { setError("Khoảng ngày chưa hợp lệ (YYYY-MM-DD, từ ngày ≤ đến ngày)."); return; }
    setError("");
    setApplied({ start, end });
  };
  const resetRange = () => { const t = todayLocal(); setStart(shift(t, -2)); setEnd(t); setApplied({ start: shift(t, -2), end: t }); setError(""); };
  return <AdminShellB active="overview" title="Tổng quan">
    <div className="page-heading"><div><h1>Tổng quan</h1><p className="meta">Đơn cập nhật từ BE · {freshness ?? "chưa có thời điểm tải thành công"}</p></div>{admin ? <form className="date-control date-range" onSubmit={applyRange}><div className="catalog-field"><label htmlFor="ov-start">Từ ngày</label><input id="ov-start" className="catalog-input" type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} /></div><div className="catalog-field"><label htmlFor="ov-end">Đến ngày</label><input id="ov-end" className="catalog-input" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div><div className="date-actions"><button className="primary" type="submit">Áp dụng</button><button className="text-link" type="button" onClick={resetRange}>Đặt lại</button></div><p className="meta date-note">Kỳ theo lịch Asia/Ho_Chi_Minh · kênh ALL</p></form> : null}</div>
    {loading ? <p className="meta">Đang tải hàng đợi đơn…</p> : null}
    {error ? <div className="order-empty" role="alert"><strong>Không tải được tổng quan</strong><p>{error}</p><Link className="text-link" href="/dang-nhap?next=%2Fquan-tri">Đăng nhập quản trị</Link></div> : null}
    {data ? <div className="desk-grid"><div className="operations">
      <section className="workbench" aria-labelledby="work-title"><div className="work-title"><span className="work-count">{data.queueTotal}</span><div><h2 id="work-title">đơn cần xử lý</h2><p className="meta scope">Đơn từ BE · chưa có kênh/thanh toán · cũ nhất trước</p></div></div>
        <div className="stage-tabs" role="tablist" aria-label="Trạng thái đơn cần xử lý">{STAGES.map((item, index) => <button key={item.code} id={`tab-${item.code}`} type="button" role="tab" aria-selected={stage === item.code} aria-controls="order-panel" tabIndex={stage === item.code ? 0 : -1} onClick={() => selectStage(item.code)} onKeyDown={(event) => onTabKey(event, index)}>{item.label}<span>{counts[item.code] ?? 0}</span></button>)}</div>
        <div id="order-panel" role="tabpanel" aria-labelledby={`tab-${stage}`}>
          {queue.length === 0 ? <div className="order-empty"><strong>Không có đơn {STAGES.find((item) => item.code === stage)?.lower ?? ""}</strong><p>Không có bản ghi ở nhóm này.</p></div> : <div className="orders-list">{queue.map((order) => <Link className="order-row" href={`/quan-tri/don-hang/${order.orderId}`} key={order.orderId} aria-label={`Mở đơn ${order.orderCode}`}><span className="order-id"><strong>{order.orderCode}</strong><small>{dayText(order.createdAt)}</small></span><span className="customer"><strong title={order.customerName ?? "Không có tên"}>{order.customerName ?? "Không có tên"}</strong><small>{STATUS_LABEL[order.status] ?? order.status} · <Money v={order.totalAmount} /></small></span><span className="order-status">{STATUS_LABEL[order.status] ?? order.status}</span><Icon name="chevron-right" /></Link>)}</div>}
        </div>
        <div className="work-footer" id="work-footer"><span className="preview-count">Hiển thị {queue.length}/{group.total} đơn {STAGES.find((item) => item.code === stage)?.lower ?? ""} · tổng {data.queueTotal}</span>{group.total > 0 ? <Link className="text-link preview-link" href={`/quan-tri/don-hang?status=${stage}`}>Xem tất cả<Icon name="arrow-right" /></Link> : null}</div>
      </section>
      <div className="desk-continuations"><div className="continuation"><Icon name="truck" /><span><strong>Giao &amp; thu COD</strong><small>Chưa có dữ liệu kênh/thanh toán trong DTO</small></span><b>—</b></div><div className="continuation"><Icon name="monitor" /><span><strong>Nháp POS</strong><small>Ngoài phạm vi read pilot</small></span><b>—</b></div></div>
      <InventoryLive />
    </div>{admin ? <FinanceLive start={applied.start} end={applied.end} /> : null}</div> : null}
  </AdminShellB>;
}
