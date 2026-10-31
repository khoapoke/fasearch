"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { AdminShellB } from "./admin-shell";
import {
  CURRENT, CURRENT_RANGE, GROWTH, INVENTORY_ROWS, MISSING_DAYS,
  MISSING_LINES, PEAK, PREVIOUS, PREVIOUS_DAYS, PREVIOUS_RANGE, REVENUE_DAYS,
  TODAY, dateText, money,
} from "./fixtures";

type Counts = Record<string, number>;
type QueueOrder = { orderId: number; orderCode: string; status: string; customerName: string | null; totalAmount: number; createdAt: string };
type Group = { total: number; rows: QueueOrder[] };
type Overview = { role: "ADMIN" | "STAFF"; counts: Counts; queueTotal: number; groups: Record<string, Group>; fetchedAt: string };
const STAGES = [
  { code: "PENDING", label: "Mới tạo", lower: "mới tạo" },
  { code: "CONFIRMED", label: "Đã xác nhận", lower: "đã xác nhận" },
  { code: "PACKING", label: "Đang đóng gói", lower: "đang đóng gói" },
];
const STATUS_LABEL: Record<string, string> = { PENDING: "Mới tạo", CONFIRMED: "Đã xác nhận", PACKING: "Đang đóng gói", SHIPPING: "Đang giao", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy", RETURNED: "Đã trả lại" };
function amount(v: number) { return v.toLocaleString("vi-VN"); }
function Money({ v }: { v: number }) { return <span className="money">{amount(v)}<span className="unit">VND</span></span>; }
function dayText(v: string) { return dateText(v); }
function Chart({ expanded = false }: { expanded?: boolean }) {
  // Compact viewBox matches the rendered card (~290px) so the approved 12px
  // SVG labels do not shrink to ~6px; expanded keeps the dialog proportions.
  const w = expanded ? 900 : 300, h = expanded ? 360 : 200;
  const margin = expanded ? { left: 54, right: 18, top: 14, bottom: 34 } : { left: 34, right: 10, top: 10, bottom: 26 };
  const pw = w - margin.left - margin.right, ph = h - margin.top - margin.bottom;
  const max = 8000000;
  const x = (i: number) => margin.left + pw * i / 29;
  const y = (v: number) => margin.top + ph * (1 - v / max);
  const points = (rows: typeof REVENUE_DAYS) => rows.map((d, i) => `${x(i).toFixed(2)},${y(d.tongThu).toFixed(2)}`).join(" ");
  return (
    <figure className={`chart chart-${expanded ? "expanded" : "compact"}`}>
      <div className="chart-frame" data-chart={expanded ? "expanded" : "compact"}>
        <svg role="img" viewBox={`0 0 ${w} ${h}`} aria-label={`Doanh thu 30 ngày kỳ này và kỳ trước, thang 0 đến 8 triệu VND`}>
          <title>Doanh thu theo ngày</title>
          <desc>30 điểm kỳ 26/09 đến 25/10/2026 và 30 điểm kỳ 27/08 đến 25/09/2026, thang 0 đến 8 triệu VND.</desc>
          <g className="chart-grid">{[[0, "0"], [2000000, "2 tr"], [4000000, "4 tr"], [6000000, "6 tr"], [8000000, "8 tr"]].map(([v, l]) => <g key={String(v)}><line x1={margin.left} x2={w - margin.right} y1={y(Number(v))} y2={y(Number(v))} /><text x={margin.left - 9} y={y(Number(v)) + 4} textAnchor="end">{l}</text></g>)}</g>
          <polyline className="previous-line" points={points(PREVIOUS_DAYS)} />
          <polyline className="current-line" points={points(REVENUE_DAYS)} />
          <circle className="last-dot" cx={x(29)} cy={y(REVENUE_DAYS[29].tongThu)} r="3.5" />
          <g className="chart-axis">{[0, 14, 29].map((i) => <text key={i} x={x(i)} y={h - 9} textAnchor={i === 0 ? "start" : i === 29 ? "end" : "middle"}>{dayText(REVENUE_DAYS[i].date).slice(0, 5)}</text>)}</g>
        </svg>
      </div>
      <figcaption className="chart-legend"><span><i className="swatch current" />{CURRENT_RANGE}</span><span><i className="swatch previous" />{PREVIOUS_RANGE}</span><small>So sánh theo ngày trong kỳ.</small></figcaption>
    </figure>
  );
}
function FinancePreview() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const chartButtonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const show = () => { dialogRef.current?.showModal(); setOpen(true); };
  const close = () => { dialogRef.current?.close(); setOpen(false); };
  useEffect(() => {
    const d = dialogRef.current; if (!d) return;
    const onClose = () => { setOpen(false); chartButtonRef.current?.focus(); };
    d.addEventListener("close", onClose); return () => d.removeEventListener("close", onClose);
  }, []);
  return (
    <aside className="finance-desk" aria-labelledby="finance-title">
      <p className="section-label">Kinh doanh · PREVIEW</p>
      <h2 className="metric-label" id="finance-title">Doanh thu 30 ngày</h2>
      <div className="revenue">{money(CURRENT)}</div>
      <p className="meta period">{CURRENT_RANGE}</p>
      <div className="comparison"><span className="trend"><Icon name="arrow-up-right" />+{GROWTH}%</span><span>so với kỳ trước <b>{money(PREVIOUS)}</b><small>{PREVIOUS_RANGE}</small></span></div>
      <p className="meta preview-mark">Fixture canonical · không phải KPI live từ BE</p>
      <div className="chart-heading"><h3>Doanh thu theo ngày</h3><span className="meta">0–8 triệu VND</span></div>
      <Chart />
      <button ref={chartButtonRef} className="chart-open" type="button" onClick={show} aria-haspopup="dialog" aria-controls="chart-dialog" aria-expanded={open}><Icon name="chart-no-axes-combined" />Xem biểu đồ lớn</button>
      <p className="peak meta">Đỉnh kỳ: <b><Money v={PEAK.tongThu} /></b> · {dayText(PEAK.date)}</p>
      <div className="today"><div><span className="meta">Hôm nay · {dayText(TODAY.date)}</span><strong><Money v={TODAY.total} /></strong></div><span className="bill-count">{TODAY.invoices} hóa đơn</span></div>
      <details className="cost"><summary><Icon name="triangle-alert" /><span><strong>Chưa đủ dữ liệu giá vốn</strong><small>{MISSING_LINES} dòng trong {MISSING_DAYS.length} ngày</small></span><Icon name="chevron-down" /></summary><div className="cost-body"><div className="cost-dates">{MISSING_DAYS.map((d) => <div key={d.date}><span>{dayText(d.date)}</span><b>{d.dongThieuVon} dòng thiếu</b></div>)}</div><p>Chưa thể hiển thị tổng lãi gộp đầy đủ. Giá vốn thiếu không được coi là 0.</p></div></details>
      <dialog ref={dialogRef} id="chart-dialog" aria-labelledby="chart-dialog-title">
        <div className="dialog-head"><h2 id="chart-dialog-title" tabIndex={-1}>Doanh thu theo ngày</h2><button className="icon-btn" type="button" aria-label="Đóng biểu đồ lớn" onClick={close}><Icon name="x" /></button></div>
        <p className="dialog-meta">30 ngày mỗi kỳ · thang 0–8 triệu VND · {CURRENT_RANGE} so với {PREVIOUS_RANGE}</p>
        <Chart expanded />
        <p className="dialog-note">Bảng số liệu đầy đủ nằm bên dưới Overview.</p>
      </dialog>
    </aside>
  );
}
function DataPreview() {
  return <section className="data-section" aria-labelledby="paired-title"><details className="paired-data"><summary><Icon name="table-2" /><span id="paired-title">Bảng số liệu hai kỳ · 30 ngày</span><Icon name="chevron-down" /></summary><div className="table-scroll" tabIndex={0} aria-label="Bảng doanh thu hai kỳ"><table><caption>Doanh thu hai kỳ · VND · PREVIEW fixture. Ngày căn theo vị trí trong kỳ, không phải cùng ngày lịch; giá vốn thiếu không được coi là 0.</caption><thead><tr><th>Ngày kỳ này</th><th className="num">Doanh thu</th><th>Giá vốn kỳ này</th><th>Ngày kỳ trước</th><th className="num">Doanh thu kỳ trước</th><th>Giá vốn kỳ trước</th></tr></thead><tbody>{REVENUE_DAYS.map((d, i) => <tr key={d.date}><td>{dayText(d.date)}</td><td className="num">{amount(d.tongThu)}</td><td>{d.covered ? "Đủ dữ liệu" : `Thiếu ${d.dongThieuVon} dòng`}</td><td>{dayText(PREVIOUS_DAYS[i].date)}</td><td className="num">{amount(PREVIOUS_DAYS[i].tongThu)}</td><td>Đủ dữ liệu</td></tr>)}</tbody></table></div></details></section>;
}
function InventoryPreview() {
  return <section className="inventory" aria-labelledby="stock-title"><div className="section-head"><div><h2 id="stock-title">Tồn kho cần chú ý</h2><p className="meta">PREVIEW fixture · 1 kho · 3 SKU</p></div><p className="exception-label"><Icon name="triangle-alert" />Theo kho: 2 mục hết hàng · 1 mục sắp hết</p></div><div className="table-scroll" tabIndex={0} aria-label="Danh sách tồn kho preview"><table><caption>PREVIEW canonical, không phải API tồn kho live; mỗi dòng là một SKU tại một kho, xếp theo quy tắc ưu tiên.</caption><thead><tr><th>SKU / Sản phẩm</th><th>Kho</th><th className="num">Tồn hiện tại</th><th className="num">Ngưỡng</th><th>Trạng thái</th></tr></thead><tbody>{INVENTORY_ROWS.map((r) => <tr key={`${r.sku}-${r.warehouse}`}><td><strong className="sku">{r.sku}</strong><small className="product-name">{r.name}</small><small className="warehouse-inline">{r.warehouse}</small></td><td className="warehouse">{r.warehouse}</td><td className={`num stock-number${r.state === "out" ? " zero" : ""}`}>{r.stock}</td><td className="num">{r.threshold}</td><td><span className={`badge ${r.state}`}>{r.state === "out" ? "Hết hàng" : "Sắp hết"}</span></td></tr>)}</tbody></table></div></section>;
}
export function OverviewClient() {
  const [data, setData] = useState<Overview | null>(null);
  const [stage, setStage] = useState("PENDING");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
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
  return <AdminShellB active="overview" title="Tổng quan">
    <div className="page-heading"><div><h1>Tổng quan</h1><p className="meta">Đơn cập nhật từ BE · {freshness ?? "chưa có thời điểm tải thành công"}</p></div>{admin ? <details className="date-control"><summary><Icon name="calendar-days" /><span>{CURRENT_RANGE}</span><Icon name="chevron-down" /></summary><div className="date-popover"><strong>Kỳ doanh thu</strong><p className="meta">30 ngày hoàn chỉnh · PREVIEW fixture</p><div className="period-selected">{CURRENT_RANGE}</div><p className="meta">So sánh: {PREVIOUS_RANGE}</p><p className="meta">Kỳ doanh thu chỉ thuộc khối preview; danh sách đơn luôn gồm mọi ngày tạo.</p></div></details> : null}</div>
    {loading ? <p className="meta">Đang tải hàng đợi đơn…</p> : null}
    {error ? <div className="order-empty" role="alert"><strong>Không tải được tổng quan</strong><p>{error}</p><Link className="text-link" href="/dang-nhap?next=%2Fquan-tri">Đăng nhập quản trị</Link></div> : null}
    {data ? <div className="desk-grid"><div className="operations">
      <section className="workbench" aria-labelledby="work-title"><div className="work-title"><span className="work-count">{data.queueTotal}</span><div><h2 id="work-title">đơn cần xử lý</h2><p className="meta scope">Đơn từ BE · chưa có kênh/thanh toán · cũ nhất trước</p></div></div>
        <div className="stage-tabs" role="tablist" aria-label="Trạng thái đơn cần xử lý">{STAGES.map((item, index) => <button key={item.code} id={`tab-${item.code}`} type="button" role="tab" aria-selected={stage === item.code} aria-controls="order-panel" tabIndex={stage === item.code ? 0 : -1} onClick={() => selectStage(item.code)} onKeyDown={(event) => onTabKey(event, index)}>{item.label}<span>{counts[item.code] ?? 0}</span></button>)}</div>
        <div id="order-panel" role="tabpanel" aria-labelledby={`tab-${stage}`}>
          {queue.length === 0 ? <div className="order-empty"><strong>Không có đơn {STAGES.find((item) => item.code === stage)?.lower ?? ""}</strong><p>Không có bản ghi ở nhóm này.</p></div> : <div className="orders-list">{queue.map((order) => <Link className="order-row" href={`/quan-tri/don-hang/${order.orderId}`} key={order.orderId} aria-label={`Mở đơn ${order.orderCode}`}><span className="order-id"><strong>{order.orderCode}</strong><small>{dayText(order.createdAt)}</small></span><span className="customer"><strong>{order.customerName ?? "Không có tên"}</strong><small>{STATUS_LABEL[order.status] ?? order.status} · <Money v={order.totalAmount} /></small></span><span className="order-status">{STATUS_LABEL[order.status] ?? order.status}</span><Icon name="chevron-right" /></Link>)}</div>}
        </div>
        <div className="work-footer" id="work-footer"><span className="preview-count">Hiển thị {queue.length}/{group.total} đơn {STAGES.find((item) => item.code === stage)?.lower ?? ""} · tổng {data.queueTotal}</span>{group.total > 0 ? <Link className="text-link preview-link" href={`/quan-tri/don-hang?status=${stage}`}>Xem tất cả<Icon name="arrow-right" /></Link> : null}</div>
      </section>
      <div className="desk-continuations"><div className="continuation"><Icon name="truck" /><span><strong>Giao &amp; thu COD</strong><small>Chưa có dữ liệu kênh/thanh toán trong DTO</small></span><b>—</b></div><div className="continuation"><Icon name="monitor" /><span><strong>Nháp POS</strong><small>Ngoài phạm vi read pilot</small></span><b>—</b></div></div>
      <InventoryPreview />
    </div>{admin ? <FinancePreview /> : null}</div> : null}
    {admin ? <DataPreview /> : null}
  </AdminShellB>;
}
