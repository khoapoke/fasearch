"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icons";
import { AdminShellB } from "./admin-shell";
import { BarChart, fillPeriods } from "./bar-chart";
import { PageHeader } from "./page-header";
import { CardSkeleton, Skeleton } from "./skeleton";
import { Num } from "./status-badge";
import { useAdminCan } from "./use-admin-role";
import { formatDate, formatDateTime, formatNumber } from "@/lib/admin-format";
import { DateInput } from "@/components/ui/date-input";

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
const PRESETS = [{ id: "today", label: "Hôm nay", days: 1 }, { id: "7", label: "7 ngày", days: 7 }, { id: "30", label: "30 ngày", days: 30 }];
// Múi giờ hiển thị/kỳ báo cáo: Asia/Ho_Chi_Minh (ngày YYYY-MM-DD theo lịch Việt Nam).
function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00+07:00`); d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const dayText = formatDateTime;
async function fetchRevenue(startDate: string, endDate: string): Promise<RevenueResult> {
  const q = new URLSearchParams({ period: "DAY", startDate, endDate, channel: "ALL" });
  const r = await fetch(`/api/admin/reports/revenue?${q}`, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok || !j.success) throw new Error(j.message || "Không tải được doanh thu.");
  const s = j.result.summary ?? {}, t = Array.isArray(j.result.timeline) ? j.result.timeline : [];
  return { summary: { totalRevenue: Number(s.totalRevenue ?? 0), totalOrders: Number(s.totalOrders ?? 0), averageOrderValue: Number(s.averageOrderValue ?? 0), totalCogs: s.totalCogs ?? null, grossProfit: s.grossProfit ?? s.totalGrossProfit ?? null }, timeline: t.map((p: RevenuePoint) => ({ date: String(p.date), revenue: Number(p.revenue ?? 0), orders: Number(p.orders ?? 0) })) };
}
function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string }>({ data: null, loading: true, error: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    void Promise.resolve().then(() => { if (!c.signal.aborted) setState((s) => ({ ...s, loading: true, error: "" })); });
    load(c.signal)
      .then((data) => { if (!c.signal.aborted) setState({ data, loading: false, error: "" }); })
      .catch((e) => { if (!c.signal.aborted) setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Không tải được dữ liệu." })); });
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, retry]);
  return { ...state, retry: () => setRetry((n) => n + 1) };
}
async function getJson<T>(url: string, signal: AbortSignal, fail: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store", signal });
  const j = await r.json();
  if (!r.ok || !j.success) throw new Error(j.message || fail);
  return j.result as T;
}

function Retry({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return <div className="order-empty ov-error" role="alert"><strong>{title}</strong><p>{message}</p><button className="secondary btn-sm" type="button" onClick={onRetry}>Thử lại</button></div>;
}

function RevenueCard({ cur, prev, loading, error, retry }: { cur: RevenueResult | null; prev: RevenueResult | null; loading: boolean; error: string; retry: () => void }) {
  if (error && !cur) return <div className="kpi-card"><Retry title="Không tải được doanh thu" message={error} onRetry={retry} /></div>;
  if (!cur || !prev || (loading && !cur)) return <div className="kpi-card"><CardSkeleton height={88} /></div>;
  const growth = prev.summary.totalRevenue > 0 ? ((cur.summary.totalRevenue - prev.summary.totalRevenue) / prev.summary.totalRevenue) * 100 : null;
  const rounded = growth === null ? 0 : Math.round(growth * 10) / 10;
  return <div className="kpi-card kpi-green">
    <span className="kpi-label">Doanh thu trong kỳ</span>
    <strong className="kpi-value"><Num value={cur.summary.totalRevenue} money tone="green" bold dimZero={false} /></strong>
    <span className="kpi-sub">
      {growth === null ? <span className="meta">Kỳ trước chưa có thu</span> : <span className={`delta-chip ${rounded > 0 ? "up" : rounded < 0 ? "down" : "flat"}`}>{rounded === 0 ? null : <Icon name={rounded < 0 ? "arrow-down-right" : "arrow-up-right"} />}{rounded > 0 ? "+" : rounded < 0 ? "−" : ""}{Math.abs(rounded).toFixed(1).replace(".", ",")}%</span>}
      <span className="meta">{formatNumber(cur.summary.totalOrders)} đơn đã thu</span>
    </span>
  </div>;
}

function KpiLink({ href, label, value, tone, sub }: { href: string; label: string; value: number | null; tone: "blue" | "red" | "amber"; sub: string }) {
  return <Link className={`kpi-card kpi-link kpi-${tone}`} href={href}>
    <span className="kpi-label">{label}</span>
    <strong className="kpi-value">{value === null ? <Skeleton width={48} height={28} /> : <Num value={value} tone={tone} bold dimZero={false} />}</strong>
    <span className="kpi-sub"><span className="meta">{sub}</span><Icon name="chevron-right" /></span>
  </Link>;
}

export function OverviewClient() {
  const [stage, setStage] = useState("PENDING");
  const [end, setEnd] = useState(todayLocal());
  const [start, setStart] = useState(() => shift(todayLocal(), -6));
  const [rangeError, setRangeError] = useState("");
  const [applied, setApplied] = useState(() => ({ start: shift(todayLocal(), -6), end: todayLocal() }));

  // Quản lý chỉ thấy (và chỉ tải) phần mình được bật quyền xem; ADMIN thấy tất cả.
  const can = useAdminCan(); const canOrders = can("ORDER_VIEW"); const canStock = can("INVENTORY_VIEW"); const canReport = can("REPORT_VIEW");
  const ov = useLoad<Overview>((signal) => canOrders ? getJson("/api/admin/overview", signal, "Không tải được Dashboard.") : Promise.reject(new Error("Không có quyền")), [canOrders]);
  const stock = useLoad<StockSummary>((signal) => canStock ? getJson("/api/admin/stock-summary?limit=5", signal, "Không tải được tồn kho.") : Promise.reject(new Error("Không có quyền")), [canStock]);
  const rev = useLoad<{ cur: RevenueResult; prev: RevenueResult }>(async () => {
    if (!canReport) throw new Error("Không có quyền");
    const len = Math.round((new Date(`${applied.end}T00:00:00+07:00`).getTime() - new Date(`${applied.start}T00:00:00+07:00`).getTime()) / 86400000) + 1;
    const [cur, prev] = await Promise.all([fetchRevenue(applied.start, applied.end), fetchRevenue(shift(applied.start, -len), shift(applied.start, -1))]);
    return { cur, prev };
  }, [applied.start, applied.end, canReport]);

  const data = ov.data;
  const counts = data?.counts ?? {};
  const queue = data?.groups?.[stage]?.rows ?? [];
  const stageTotal = data?.groups?.[stage]?.total ?? 0;
  const stageInfo = STAGES.find((item) => item.code === stage);

  const chartData = useMemo(() => {
    if (!rev.data) return [];
    const { cur, prev } = rev.data;
    const len = Math.round((new Date(`${applied.end}T00:00:00+07:00`).getTime() - new Date(`${applied.start}T00:00:00+07:00`).getTime()) / 86400000) + 1;
    const prevByDate = new Map(prev.timeline.map((p) => [p.date.slice(0, 10), p.revenue]));
    return fillPeriods({
      from: applied.start, to: applied.end, granularity: "DAY",
      rows: cur.timeline.map((p) => ({ date: p.date, value: p.revenue, count: p.orders })),
    }).map((d) => ({ ...d, compare: prevByDate.get(shift(d.key, -len)) ?? 0 }));
  }, [rev.data, applied.start, applied.end]);

  const selectStage = (next: string) => { setStage(next); requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus()); };
  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? STAGES.length - 1 : event.key === "ArrowRight" ? (index + 1) % STAGES.length : (index - 1 + STAGES.length) % STAGES.length;
    selectStage(STAGES[next].code);
  };
  const apply = (nextStart: string, nextEnd: string) => {
    setStart(nextStart); setEnd(nextEnd);
    if (!ISO.test(nextStart) || !ISO.test(nextEnd)) { setRangeError(""); return; }
    if (nextStart > nextEnd) { setRangeError("Từ ngày phải trước hoặc bằng đến ngày."); return; }
    setRangeError("");
    setApplied({ start: nextStart, end: nextEnd });
  };
  const preset = (days: number) => { const t = todayLocal(); apply(shift(t, -(days - 1)), t); };
  const activePreset = PRESETS.find((p) => applied.end === todayLocal() && applied.start === shift(todayLocal(), -(p.days - 1)))?.id ?? null;

  const hint = "Doanh thu tính theo đơn đã thanh toán, ngày theo giờ Việt Nam; mũi tên so với kỳ trước cùng độ dài. Đơn cần xử lý xếp đơn cũ nhất trước.";

  return <AdminShellB active="overview" title="Dashboard">
    <PageHeader title="Dashboard" hint={hint} actions={<div className="range-controls">
      <div className="seg" role="group" aria-label="Khoảng thời gian">{PRESETS.map((p) => <button key={p.id} type="button" aria-pressed={activePreset === p.id} onClick={() => preset(p.days)}>{p.label}</button>)}</div>
      <div className="range-dates">
        <DateInput id="ov-start" aria-label="Từ ngày" className="catalog-input" value={start} max={end} onChange={(v) => apply(v, end)} />
        <span aria-hidden="true">–</span>
        <DateInput id="ov-end" aria-label="Đến ngày" className="catalog-input" value={end} min={start} onChange={(v) => apply(start, v)} />
      </div>
    </div>} />
    {rangeError ? <p className="catalog-error" role="alert">{rangeError}</p> : null}
    <div className="kpi-row">
      {canReport ? <RevenueCard cur={rev.data?.cur ?? null} prev={rev.data?.prev ?? null} loading={rev.loading} error={rev.error} retry={rev.retry} /> : null}
      {canOrders ? <KpiLink href="/quan-tri/don-hang" label="Đơn cần xử lý" value={data ? data.queueTotal : null} tone="blue" sub={data ? `trong đó ${formatNumber(counts.PENDING ?? 0)} đơn mới tạo` : "Đang tải"} /> : null}
      {canStock ? <KpiLink href="/quan-tri/ton-kho" label="Hết hàng" value={stock.data ? stock.data.outOfStock : null} tone="red" sub="SKU không còn khả dụng" /> : null}
      {canStock ? <KpiLink href="/quan-tri/ton-kho" label="Sắp hết" value={stock.data ? stock.data.lowStock : null} tone="amber" sub="SKU dưới ngưỡng" /> : null}
    </div>
    <div className="ov-grid">
      <div className="ov-left">
        {canOrders ? <section className="ov-card" aria-labelledby="work-title">
          <div className="ov-card-head">
            <h2 id="work-title">Đơn cần xử lý</h2>
            <div className="stage-tabs" role="tablist" aria-label="Trạng thái đơn cần xử lý">{STAGES.map((item, index) => <button key={item.code} id={`tab-${item.code}`} type="button" role="tab" aria-selected={stage === item.code} aria-controls="order-panel" tabIndex={stage === item.code ? 0 : -1} onClick={() => selectStage(item.code)} onKeyDown={(event) => onTabKey(event, index)}>{item.label}<span>{counts[item.code] ?? 0}</span></button>)}</div>
          </div>
          <div id="order-panel" role="tabpanel" aria-labelledby={`tab-${stage}`} className="ov-list">
            {ov.error ? <Retry title="Không tải được hàng đợi đơn" message={ov.error} onRetry={ov.retry} /> : !data ? <div className="ov-skel">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} height={36} />)}</div> : queue.length === 0 ? <div className="ov-empty"><strong>Không có đơn {stageInfo?.lower}</strong></div> : queue.slice(0, 5).map((order) => <Link className="ov-row" href={`/quan-tri/don-hang/${order.orderId}`} key={order.orderId} aria-label={`Mở đơn ${order.orderCode}`}>
              <span className="ov-code">{order.orderCode}</span>
              <span className="ov-name" title={order.customerName ?? "Chưa có tên"}>{order.customerName ?? "Chưa có tên"}</span>
              <span className="ov-date">{dayText(order.createdAt)}</span>
              <Num value={order.totalAmount} money tone="ink" dimZero={false} />
            </Link>)}
          </div>
          {data && stageTotal > 0 ? <div className="ov-foot"><span className="meta">{Math.min(5, queue.length)}/{formatNumber(stageTotal)} đơn {stageInfo?.lower}, cũ nhất trước</span><Link className="text-link" href={`/quan-tri/don-hang?status=${stage}`}>Xem tất cả<Icon name="arrow-right" /></Link></div> : null}
        </section> : null}
        {canStock ? <section className="ov-card" aria-labelledby="stock-title">
          <div className="ov-card-head"><h2 id="stock-title">Tồn kho cần chú ý</h2><Link className="text-link" href="/quan-tri/ton-kho">Xem tất cả<Icon name="arrow-right" /></Link></div>
          <div className="ov-list">
            {stock.error ? <Retry title="Không tải được tồn kho" message={stock.error} onRetry={stock.retry} /> : !stock.data ? <div className="ov-skel">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} height={30} />)}</div> : stock.data.exceptions.length === 0 ? <div className="ov-empty"><strong>Tồn kho ổn định</strong></div> : stock.data.exceptions.slice(0, 5).map((r) => { const out = r.availableStock <= 0; const name = `${r.productName}${r.color ? ` · ${r.color}` : ""}${r.size ? ` · ${r.size}` : ""}`; return <Link className="ov-row ov-stock" key={r.skuId} href={`/quan-tri/ton-kho/${r.skuId}`} aria-label={`Mở tồn kho ${name}`}>
              <span className="ov-name" title={name}>{name}</span>
              <Num value={r.availableStock} tone={out ? "red" : "amber"} bold dimZero={false} />
              <span className={`badge ${out ? "t-red" : "t-amber"}`}>{out ? "Hết hàng" : "Sắp hết"}</span>
            </Link>; })}
          </div>
        </section> : null}
      </div>
      {canReport ? <section className="ov-card ov-chart" aria-labelledby="chart-title">
        <div className="ov-card-head"><h2 id="chart-title">Doanh thu theo ngày</h2><span className="meta">{formatDate(applied.start)} – {formatDate(applied.end)}</span></div>
        <div className="ov-chart-body">
          {rev.error && !rev.data ? <Retry title="Không tải được doanh thu" message={rev.error} onRetry={rev.retry} /> : !rev.data ? <Skeleton height={300} /> : <BarChart title="Doanh thu theo ngày" data={chartData} tone="green" height={350} formatValue={(v) => `${formatNumber(v)} đ`} countUnit="đơn" valueHeader="Doanh thu" />}
        </div>
      </section> : null}
    </div>
    {!canOrders && !canStock && !canReport ? <div className="order-empty"><strong>Chưa có mục nào để hiển thị</strong><p>Tài khoản Quản lý của bạn chưa được bật quyền xem đơn hàng, tồn kho hoặc Report.</p></div> : null}
  </AdminShellB>;
}
