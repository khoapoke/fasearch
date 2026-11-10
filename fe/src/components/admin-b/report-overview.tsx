"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDate, formatNumber } from "@/lib/admin-format";
import {
  computeDelta, daysBetween, fetchOverview, fetchStockHealth, groupPayments, ORDER_STATUS, previousRange, topCategories,
  type Delta, type Overview, type StockHealth,
} from "@/lib/admin-reports-overview";
import { fetchRevenue, type RevenueResult } from "@/lib/reports-client";
import { HBarChart, compactVnd, fillPeriods, periodTitle, type Granularity } from "./bar-chart";
import { InfoHint } from "./info-hint";
import { CardSkeleton } from "./skeleton";
import { DonutChart, OrdersAovChart, type ComboPoint } from "./report-charts";
import "./s1.css";


type Loaded = {
  key: string;
  from: string;
  to: string;
  current: Overview;
  previous: Overview | null;
  daily: RevenueResult | null;
  dailyPeriod: "DAY" | "WEEK";
  stock: StockHealth | null;
};

const money = (v: number) => `${formatNumber(Math.round(v))} đ`;
const dmy = (iso: string) => iso.split("-").reverse().join("/");

function DeltaChip({ delta, previousText, compare }: { delta: Delta; previousText: string; compare: boolean }) {
  if (!compare) return null;
  if (delta.kind === "none") {
    return <span className="s1-delta is-none" title="Không so sánh được vì kỳ trước bằng 0"><span aria-hidden="true">—</span><span className="sr-only">Không so sánh được vì kỳ trước bằng 0</span></span>;
  }
  const arrow = delta.kind === "up" ? "▲" : delta.kind === "down" ? "▼" : "■";
  const word = delta.kind === "up" ? "tăng" : delta.kind === "down" ? "giảm" : "không đổi";
  return (
    <span className={`s1-delta is-${delta.kind}`} title={`So với kỳ trước: ${previousText}`}>
      <span aria-hidden="true">{arrow}</span> {delta.text}
      <span className="sr-only"> {word} so với kỳ trước ({previousText})</span>
    </span>
  );
}

function Kpi({ label, value, delta, previousText, compare, hint }: { label: string; value: string; delta: Delta; previousText: string; compare: boolean; hint: string }) {
  return (
    <div className="s1-kpi">
      <span className="s1-kpi-label">{label}<InfoHint align="start">{hint}</InfoHint></span>
      <span className="s1-kpi-value">{value}</span>
      <span className="s1-kpi-foot"><DeltaChip delta={delta} previousText={previousText} compare={compare} />{compare ? <span className="s1-kpi-prev">Kỳ trước {previousText}</span> : null}</span>
    </div>
  );
}

function CardHead({ title, hint, href, linkLabel, onClick }: { title: string; hint: React.ReactNode; href?: string; linkLabel?: string; onClick?: () => void }) {
  return (
    <div className="s1-card-head">
      <h2>{title}</h2>
      <InfoHint align="start">{hint}</InfoHint>
      {href ? <Link className="s1-more" href={href}>{linkLabel ?? "Chi tiết"} →</Link> : null}
      {onClick ? <button type="button" className="s1-more" onClick={onClick}>{linkLabel ?? "Chi tiết"} →</button> : null}
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="s1-empty">{children}</p>;

export function ReportOverview({ from, to, compare, onOpenTab }: { from: string; to: string; compare: boolean; onOpenTab: (tab: "doanh-thu" | "san-pham") => void }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status: number } | null>(null);
  const [reload, setReload] = useState(0);
  const requestId = useRef(0);
  const key = `${from}|${to}|${compare}`;

  useEffect(() => {
    const id = ++requestId.current;
    const ctl = new AbortController();
    const days = daysBetween(from, to) + 1;
    const dailyPeriod = days <= 62 ? "DAY" : "WEEK";
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [pf, pt] = previousRange(from, to);
        const [current, previous, daily, stock] = await Promise.all([
          fetchOverview(from, to, ctl.signal),
          compare ? fetchOverview(pf, pt, ctl.signal).catch(() => null) : Promise.resolve(null),
          fetchRevenue(new URLSearchParams({ period: dailyPeriod, startDate: from, endDate: to, channel: "ALL" }).toString()).catch(() => null),
          fetchStockHealth(ctl.signal).catch(() => null),
        ]);
        if (id !== requestId.current) return;
        setData({ key, from, to, current, previous, daily, dailyPeriod, stock });
      } catch (e) {
        if (id !== requestId.current || ctl.signal.aborted) return;
        const st = (e as { status?: number })?.status ?? 0;
        setError({
          status: st,
          message: st === 401 ? "Phiên đăng nhập đã hết. Đăng nhập lại." : st === 403 ? "Tài khoản không có quyền xem Report (cần Quản trị viên hoặc Quản lý)." : e instanceof Error ? e.message : "Không tải được báo cáo.",
        });
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    })();
    return () => ctl.abort();
  }, [from, to, compare, key, reload]);

  if (error) {
    return (
      <div className="order-empty" role="alert">
        <strong>Không tải được Report</strong>
        <p>{error.message}</p>
        <button className="secondary" type="button" onClick={() => setReload((n) => n + 1)}>Thử lại</button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="s1-grid" aria-hidden="true">
        <div className="s1-span-12 s1-kpis"><CardSkeleton height={84} /><CardSkeleton height={84} /><CardSkeleton height={84} /><CardSkeleton height={84} /></div>
        <div className="s1-span-8"><CardSkeleton height={270} /></div>
        <div className="s1-span-4"><CardSkeleton height={270} /></div>
      </div>
    );
  }
  return <OverviewBody data={data} compare={compare} stale={loading} onOpenTab={onOpenTab} />;
}

function OverviewBody({ data, compare, stale, onOpenTab }: { data: Loaded; compare: boolean; stale: boolean; onOpenTab: (tab: "doanh-thu" | "san-pham") => void }) {
  const { current, previous, from, to } = data;
  const [pf, pt] = previousRange(from, to);
  const prevRange = `${dmy(pf)} – ${dmy(pt)}`;
  const k = current.kpi;
  const pk = previous?.kpi ?? null;
  const showCompare = compare && pk !== null;

  const daily = useMemo<ComboPoint[]>(() => {
    const g = data.dailyPeriod as Granularity;
    const rows = data.daily?.timeline.map((p) => ({ date: p.date, value: p.revenue, count: p.orders })) ?? [];
    return fillPeriods({ from, to, granularity: g, rows }).map((d) => ({
      key: d.key,
      label: d.label,
      title: periodTitle(d.key, g),
      orders: d.count ?? 0,
      revenue: d.value,
      aov: d.count ? Math.round(d.value / d.count) : null,
    }));
  }, [data.daily, data.dailyPeriod, from, to]);

  const cats = useMemo(() => topCategories(current.byCategory, 8), [current.byCategory]);
  const catTotal = cats.reduce((s, c) => s + c.revenue, 0);
  const pct = (v: number, t: number) => (t > 0 ? `${((v / t) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%` : "0%");

  const pays = useMemo(() => groupPayments(current.byPayment, 5), [current.byPayment]);
  const payTotal = pays.reduce((s, p) => s + p.revenue, 0);

  const statusRows = ORDER_STATUS.map((s) => ({ ...s, orders: current.byStatus.find((x) => x.status === s.status)?.orders ?? 0 }));
  const unknown = current.byStatus.filter((x) => !ORDER_STATUS.some((s) => s.status === x.status));
  const statusTotal = statusRows.reduce((s, r) => s + r.orders, 0) + unknown.reduce((s, r) => s + r.orders, 0);
  const range = `from=${from}&to=${to}`;

  const stock = data.stock;
  const stockTotal = stock ? stock.outOfStock + stock.lowStock + stock.healthyStock : 0;

  return (
    <div className={`s1-grid${stale ? " is-stale" : ""}`} aria-busy={stale}>
      <section className="s1-span-12 s1-kpis" aria-label="Chỉ số chính">
        <Kpi label="Doanh thu" value={money(k.revenue)} delta={computeDelta(k.revenue, pk?.revenue)} previousText={pk ? money(pk.revenue) : ""} compare={showCompare}
          hint="Tổng tiền của hóa đơn đã thanh toán trong kỳ (không tính đơn hủy hoặc Draft), theo ngày lập hóa đơn. Giống tab Doanh thu." />
        <Kpi label="Số đơn" value={formatNumber(k.orders)} delta={computeDelta(k.orders, pk?.orders)} previousText={pk ? formatNumber(pk.orders) : ""} compare={showCompare}
          hint="Số hóa đơn đã thanh toán trong kỳ, mỗi đơn một hóa đơn. Đơn chờ thanh toán chưa được tính." />
        <Kpi label="Giá trị đơn trung bình" value={money(k.averageOrderValue)} delta={computeDelta(k.averageOrderValue, pk?.averageOrderValue)} previousText={pk ? money(pk.averageOrderValue) : ""} compare={showCompare}
          hint="Doanh thu chia cho số đơn đã thanh toán. Bằng 0 khi chưa có đơn." />
        <Kpi label="Khách mới" value={formatNumber(k.newCustomers)} delta={computeDelta(k.newCustomers, pk?.newCustomers)} previousText={pk ? formatNumber(pk.newCustomers) : ""} compare={showCompare}
          hint="Số khách có đơn đầu tiên (không phải đơn hủy hoặc Draft) được đặt trong kỳ. Khách đã xóa không tính." />
      </section>
      {compare && !pk ? <p className="s1-span-12 s1-note" role="status">Chưa so sánh được với kỳ trước ({prevRange}).</p> : null}

      <section className="form-card s1-card s1-span-8" aria-label="Số đơn và giá trị đơn trung bình theo ngày">
        <CardHead title={data.dailyPeriod === "DAY" ? "Số đơn và giá trị đơn trung bình theo ngày" : "Số đơn và giá trị đơn trung bình theo tuần"} onClick={() => onOpenTab("doanh-thu")} linkLabel="Doanh thu"
          hint="Cột là số hóa đơn đã thanh toán, đường là doanh thu chia số đơn của ngày đó. Hai trục khác thang đo: trục trái đếm đơn, trục phải tính đồng. Ngày không có đơn hiện cột trống và đường ngắt, không phải 0 đồng." />
        {k.orders === 0 ? <Empty>Chưa có đơn đã thanh toán từ {dmy(from)} đến {dmy(to)}.</Empty> : <OrdersAovChart title="Số đơn và giá trị đơn trung bình" data={daily} height={196} />}
      </section>

      <section className="form-card s1-card s1-span-4" aria-label="Phương thức thanh toán">
        <CardHead title="Phương thức thanh toán"
          hint="Doanh thu của hóa đơn đã thanh toán theo phương thức khách trả. Tối đa 5 nhóm, phương thức còn lại gộp vào Khác." />
        {pays.length === 0 || payTotal === 0 ? <Empty>Chưa có hóa đơn đã thanh toán trong kỳ.</Empty> : (
          <DonutChart title="Doanh thu theo phương thức thanh toán" formatValue={(v) => compactVnd(v) + " đ"} centerValue={compactVnd(payTotal)} centerLabel="doanh thu"
            slices={pays.map((p) => ({ key: p.method, label: p.method, value: p.revenue, detail: `${formatNumber(p.invoices)} đơn` }))} />
        )}
      </section>

      <section className="form-card s1-card s1-span-5" aria-label="Doanh thu theo danh mục">
        <CardHead title="Doanh thu theo danh mục" onClick={() => onOpenTab("san-pham")} linkLabel="Sản phẩm"
          hint="Giá trị dòng hàng của hóa đơn đã thanh toán (số lượng x đơn giá, trừ giảm giá dòng và điểm). Chưa gồm phí vận chuyển và giảm giá cả đơn nên tổng nhỏ hơn hoặc bằng Doanh thu. Top 8 danh mục, phần còn lại gộp vào Khác." />
        {cats.length === 0 || catTotal === 0 ? <Empty>Chưa có hàng bán được trong kỳ.</Empty> : (
          <HBarChart title="Doanh thu theo danh mục" tone="blue"
            data={cats.map((c) => ({ key: `${c.categoryId ?? "k"}-${c.categoryName}`, label: c.categoryName, value: c.revenue, tooltip: `${c.categoryName} · ${money(c.revenue)} · ${pct(c.revenue, catTotal)} · ${formatNumber(c.quantity)} sản phẩm` }))}
            formatValue={(v) => `${compactVnd(v)} · ${pct(v, catTotal)}`} />
        )}
      </section>

      <section className="form-card s1-card s1-span-7" aria-label="Top 10 khách hàng">
        <CardHead title="Top 10 khách hàng" href="/quan-tri/khach-hang" linkLabel="Khách hàng"
          hint="Khách có doanh thu hóa đơn đã thanh toán cao nhất trong kỳ. Đơn bán tại quầy không gắn khách không có trong bảng. Ngày mua là hóa đơn gần nhất trong kỳ." />
        {current.topCustomers.length === 0 ? <Empty>Chưa có khách mua hàng trong kỳ.</Empty> : (
          <table className="s1-table">
            <caption className="sr-only">Top 10 khách hàng theo doanh thu</caption>
            <thead><tr><th className="num">Hạng</th><th>Khách hàng</th><th className="num">Số đơn</th><th className="num">Doanh thu</th><th className="num">Mua gần nhất</th></tr></thead>
            <tbody>
              {current.topCustomers.map((c, i) => (
                <tr key={c.customerId}>
                  <td className="num s1-rank">{i + 1}</td>
                  <td className="s1-name">{c.deleted ? <span title="Khách đã xóa">{c.name || "Khách"} (đã xóa)</span> : <Link href={`/quan-tri/khach-hang/${c.customerId}`} title={c.name}>{c.name || "Khách chưa có tên"}</Link>}</td>
                  <td className="num">{formatNumber(c.orders)}</td>
                  <td className="num s1-money">{money(c.revenue)}</td>
                  <td className="num">{formatDate(c.lastOrderAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="form-card s1-card s1-span-7" aria-label="Đơn theo trạng thái">
        <CardHead title="Đơn theo trạng thái" href={`/quan-tri/don-hang?${range}`} linkLabel="Đơn hàng"
          hint="Số đơn được tạo trong kỳ theo trạng thái hiện tại của đơn, kể cả đơn chưa thanh toán và đơn hủy; không tính đơn Draft. Bấm một trạng thái để mở danh sách đơn." />
        {statusTotal === 0 ? <Empty>Không có đơn nào được tạo trong kỳ.</Empty> : (
          <>
            <div className="s1-stack" role="img" aria-label={`Đơn theo trạng thái: ${statusRows.filter((r) => r.orders > 0).map((r) => `${r.label} ${r.orders}`).join(", ")}`}>
              {statusRows.filter((r) => r.orders > 0).map((r) => (
                <Link key={r.status} href={`/quan-tri/don-hang?status=${r.status}&${range}`} className="s1-seg" title={`${r.label}: ${formatNumber(r.orders)} đơn (${pct(r.orders, statusTotal)})`}
                  style={{ flexGrow: r.orders, background: `var(--t-${r.tone})` }} aria-label={`${r.label}: ${r.orders} đơn`} />
              ))}
            </div>
            <ul className="s1-status-list">
              {statusRows.map((r) => (
                <li key={r.status} className={r.orders === 0 ? "is-zero" : ""}>
                  <Link href={`/quan-tri/don-hang?status=${r.status}&${range}`}>
                    <span className="s1-swatch" style={{ background: `var(--t-${r.tone})` }} aria-hidden="true" />
                    <span className="s1-status-label">{r.label}</span>
                    <span className="s1-status-n">{formatNumber(r.orders)}</span>
                    <span className="s1-status-pct">{pct(r.orders, statusTotal)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="form-card s1-card s1-span-5" aria-label="Sức khỏe tồn kho">
        <CardHead title="Sức khỏe tồn kho" href="/quan-tri/ton-kho" linkLabel="Tồn kho"
          hint="Số SKU hiện tại theo tồn khả dụng: hết hàng là 0, sắp hết là bằng hoặc dưới ngưỡng tối thiểu của SKU, ổn định là trên ngưỡng. Là tình trạng hôm nay, không phụ thuộc kỳ Report." />
        {!stock || stockTotal === 0 ? <Empty>Chưa lấy được số liệu tồn kho.</Empty> : (
          <>
            <div className="s1-stack" role="img" aria-label={`Tồn kho: ${stock.outOfStock} hết hàng, ${stock.lowStock} sắp hết, ${stock.healthyStock} ổn định`}>
              {[{ n: stock.outOfStock, tone: "red", label: "Hết hàng" }, { n: stock.lowStock, tone: "amber", label: "Sắp hết" }, { n: stock.healthyStock, tone: "green", label: "Ổn định" }]
                .filter((x) => x.n > 0).map((x) => <span key={x.tone} className="s1-seg" style={{ flexGrow: x.n, background: `var(--t-${x.tone})` }} title={`${x.label}: ${formatNumber(x.n)} SKU`} />)}
            </div>
            <ul className="s1-stock-list">
              <li><span className="s1-swatch" style={{ background: "var(--t-red)" }} aria-hidden="true" /><span>Hết hàng</span><b>{formatNumber(stock.outOfStock)}</b></li>
              <li><span className="s1-swatch" style={{ background: "var(--t-amber)" }} aria-hidden="true" /><span>Sắp hết</span><b>{formatNumber(stock.lowStock)}</b></li>
              <li><span className="s1-swatch" style={{ background: "var(--t-green)" }} aria-hidden="true" /><span>Ổn định</span><b>{formatNumber(stock.healthyStock)}</b></li>
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
