"use client";

import "@/components/admin-b/f5.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateInput } from "@/components/ui/date-input";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { BarChart, HBarChart, fillPeriods, periodTitle, type Granularity } from "@/components/admin-b/bar-chart";
import { InfoHint } from "@/components/admin-b/info-hint";
import { PageHeader } from "@/components/admin-b/page-header";
import { ReportOverview } from "@/components/admin-b/report-overview";
import { REPORT_PRESETS, presetOf } from "@/lib/admin-reports-overview";
import { Pager } from "@/components/admin-b/pagination";
import { CardSkeleton, TableSkeleton } from "@/components/admin-b/skeleton";
import { Num } from "@/components/admin-b/status-badge";
import { formatNumber } from "@/lib/admin-format";
import {
  downloadCsv, fetchMovement, fetchRevenue, fetchTopProducts,
  type MovementResult, type RevenueResult, type TopProductRow,
} from "@/lib/reports-client";
import {
  buildMovementQuery, buildRevenueQuery, buildTopQuery, normalizeTopN, reportCsvName, validateReportRange,
  type ReportFilters, type RevenuePeriod, type TopType,
} from "@/lib/reports";

type Tab = "tong-hop" | "doanh-thu" | "san-pham" | "xuat-nhap-ton";

type Loaded = {
  tab: Tab;
  from: string;
  to: string;
  period: RevenuePeriod;
  doanhThu?: RevenueResult;
  sanPham?: TopProductRow[];
  sanPhamType?: TopType;
  xnt?: MovementResult;
};

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "tong-hop", label: "Tổng hợp" },
  { key: "doanh-thu", label: "Doanh thu" },
  { key: "san-pham", label: "Sản phẩm" },
  { key: "xuat-nhap-ton", label: "Xuất–nhập–tồn" },
];

const PERIOD_TITLE: Record<RevenuePeriod, string> = { DAY: "ngày", WEEK: "tuần", MONTH: "tháng", YEAR: "năm" };

const TZ = "Asia/Ho_Chi_Minh";
const fmtIso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const today = () => fmtIso(new Date());
const monthStart = () => today().slice(0, 7) + "-01";
const dmy = (iso: string) => iso.split("-").reverse().join("/");

const PRESETS = REPORT_PRESETS;

const moneyText = (v: number) => `${formatNumber(v)} đ`;

type Filters = ReportFilters & { topN: number; loaiTop: TopType; thang: string };

const XNT_EXPORT_MAX_PAGES = 50;

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("tong-hop");
  const [compare, setCompare] = useState(true);
  const [f, setF] = useState<Filters>({
    tuNgay: monthStart(), denNgay: today(), period: "DAY", type: "BEST_SELLER", limit: 10, topN: 10, loaiTop: "BEST_SELLER", thang: "",
    sku: "", page: 0, size: 20,
  });
  const [skuInput, setSkuInput] = useState("");
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ message: string; status: number } | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const rangeError = (() => {
    try { validateReportRange(f.tuNgay, f.denNgay); return ""; } catch (e) { return e instanceof Error ? e.message : "Khoảng ngày chưa hợp lệ."; }
  })();

  const load = useCallback(async () => {
    const id = ++requestId.current;
    if (rangeError || tab === "tong-hop") { setLoading(false); return; }
    setLoading(true);
    setFailure(null);
    try {
      validateReportRange(f.tuNgay, f.denNgay);
      const base = { tab, from: f.tuNgay, to: f.denNgay, period: (f.period ?? "DAY") as RevenuePeriod };
      let next: Loaded;
      if (tab === "doanh-thu") {
        const q = buildRevenueQuery({ tuNgay: f.tuNgay, denNgay: f.denNgay, period: f.period });
        next = { ...base, doanhThu: await fetchRevenue(q) };
      } else if (tab === "san-pham") {
        const q = buildTopQuery({ tuNgay: f.tuNgay, denNgay: f.denNgay, type: f.loaiTop, limit: normalizeTopN(f.topN) });
        next = { ...base, sanPham: await fetchTopProducts(q), sanPhamType: f.loaiTop };
      } else {
        const q = buildMovementQuery({ tuNgay: f.tuNgay, denNgay: f.denNgay, page: f.page, size: f.size, month: f.thang, sku: f.sku });
        next = { ...base, xnt: await fetchMovement(q) };
      }
      if (id !== requestId.current) return;
      setData(next);
    } catch (e) {
      if (id !== requestId.current) return;
      const st = (e as { status?: number })?.status ?? 0;
      setFailure({
        status: st,
        message: st === 401 ? "Phiên đăng nhập đã hết. Đăng nhập lại." : st === 403 ? "Tài khoản không có quyền xem Report (cần Quản trị viên hoặc Quản lý)." : e instanceof Error ? e.message : "Không tải được báo cáo.",
      });
      setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [rangeError, tab, f.tuNgay, f.denNgay, f.period, f.loaiTop, f.topN, f.thang, f.sku, f.page, f.size]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  // SKU search commits after a short pause so typing does not fire a request per key.
  useEffect(() => {
    if (skuInput === (f.sku ?? "")) return;
    const t = window.setTimeout(() => setF((p) => ({ ...p, sku: skuInput, page: 0 })), 350);
    return () => window.clearTimeout(t);
  }, [skuInput, f.sku]);

  function set<K extends keyof Filters>(k: K, v: Filters[K]) {
    setF((prev) => ({ ...prev, [k]: v, ...(k === "page" ? {} : { page: 0 }) }));
  }

  function onTabKey(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = TABS.length - 1;
    const next = event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    setTab(TABS[next].key);
    document.getElementById(`report-tab-${TABS[next].key}`)?.focus();
  }

  const ready = data && data.tab === tab ? data : null;
  const overviewTab = tab === "tong-hop";
  const activePreset = presetOf(f.tuNgay, f.denNgay);

  async function csv() {
    if (!ready || tab === "tong-hop") return;
    setCsvBusy(true);
    setCsvError("");
    try {
      const name = reportCsvName(tab === "san-pham" ? "san-pham" : tab, f.tuNgay, f.denNgay);
      if (tab === "doanh-thu" && ready.doanhThu) {
        // Same zero-filled series as the chart and the table, so the file matches the screen.
        const series = fillPeriods({
          from: ready.from, to: ready.to, granularity: ready.period as Granularity,
          rows: ready.doanhThu.timeline.map((p) => ({ date: p.date, value: p.revenue, count: p.orders })),
        });
        downloadCsv(name, ["Ngay", "SoDon", "DoanhThu"], series.map((r) => [r.key, r.count ?? 0, r.value]));
      } else if (tab === "san-pham" && ready.sanPham) {
        downloadCsv(name, ["Hang", "MaSP", "TenSP", "DanhMuc", "SLBan", "DoanhThu", "TonHienTai"],
          ready.sanPham.map((r) => [r.rank, r.productId, r.productName, r.categoryName ?? "", r.totalQuantitySold, r.totalRevenue, r.currentInventory ?? ""]));
      } else if (tab === "xuat-nhap-ton" && ready.xnt) {
        // The screen shows one page; the file holds every page of the current month and SKU filter (bounded).
        const items: typeof ready.xnt.items = [];
        let totalPages = 1;
        let totalElements = 0;
        for (let p = 0; p < Math.min(totalPages, XNT_EXPORT_MAX_PAGES); p++) {
          const part = await fetchMovement(buildMovementQuery({ tuNgay: f.tuNgay, denNgay: f.denNgay, page: p, size: 100, month: f.thang, sku: f.sku }));
          items.push(...part.items);
          totalPages = part.totalPages;
          totalElements = part.totalElements;
        }
        if (totalPages > XNT_EXPORT_MAX_PAGES) setCsvError(`File chỉ gồm ${formatNumber(items.length)} dòng đầu trong ${formatNumber(totalElements)} dòng. Lọc theo SKU để lấy phần còn lại.`);
        downloadCsv(name, ["SKU", "TenSP", "Mau", "Co", "MaVach", "Nhap", "Ban", "Hong", "TonHienTai"],
          items.map((r) => [r.skuId, r.productName, r.color ?? "", r.size ?? "", r.barcode ?? "", r.totalImport ?? "", r.totalSold, r.totalDamaged ?? "", r.closingStock ?? ""]));
      }
    } catch (e) {
      setCsvError(e instanceof Error ? e.message : "Tải CSV thất bại.");
    } finally {
      setCsvBusy(false);
    }
  }

  const hint = overviewTab
    ? "Tổng hợp nhanh theo kỳ đã chọn. Doanh thu, số đơn và khách hàng tính từ hóa đơn đã thanh toán; đơn theo trạng thái tính các đơn tạo trong kỳ. Mỗi thẻ có giải thích riêng."
    : tab === "doanh-thu"
    ? "Doanh thu tính từ hóa đơn đã thu. Giá vốn và lãi gộp chưa có dữ liệu nên không hiển thị."
    : tab === "san-pham"
      ? "Bán chạy xếp theo số lượng bán trong kỳ (hóa đơn đã thu). Bán chậm là sản phẩm không bán được cái nào trong kỳ, kể cả sản phẩm đã hết hàng; cột Tồn là số khả dụng hiện tại."
      : "Nhập và Hỏng lấy từ phiếu nhập và phiếu xuất hỏng đã hoàn tất trong tháng; Xuất bán lấy từ hóa đơn đã thu, nên hàng hỏng không bị tính hai lần. Không có dữ liệu tồn đầu tháng nên cột này không hiển thị; Tồn cuối là số khả dụng hiện tại, không phải tồn cuối tháng.";

  return (
    <AdminShellB active="reports" title="Report">
      <PageHeader
        title="Report"
        hint={hint}
        actions={overviewTab ? undefined : <button className="secondary" type="button" disabled={csvBusy || !ready} onClick={csv} title={tab === "xuat-nhap-ton" ? "Xuất mọi dòng theo bộ lọc hiện tại, không chỉ trang đang xem" : undefined}>{csvBusy ? "Đang export…" : "Export CSV"}</button>}
      />
      <div className="rp-toolbar">
        <div className="stage-tabs report-tabs" role="tablist" aria-label="Loại Report">
          {TABS.map((item, index) => (
            <button
              key={item.key}
              id={`report-tab-${item.key}`}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              aria-controls="report-panel"
              tabIndex={tab === item.key ? 0 : -1}
              onClick={() => setTab(item.key)}
              onKeyDown={(event) => onTabKey(event, index)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="rp-filters" role="group" aria-label="Bộ lọc Report">
          <div className="seg" role="group" aria-label="Khoảng thời gian">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" aria-pressed={activePreset === p.id} onClick={() => { const [a, b] = p.range(); setF((prev) => ({ ...prev, tuNgay: a, denNgay: b, page: 0 })); }}>{p.label}</button>
            ))}
            <button type="button" aria-pressed={activePreset === "custom"} onClick={() => document.getElementById("rp-from")?.focus()}>Tùy chọn</button>
          </div>
          <div className="range-dates">
            <DateInput id="rp-from" className="catalog-input" value={f.tuNgay} max={f.denNgay} onChange={(v) => { if (/^\d{4}-\d{2}-\d{2}$/.test(v)) set("tuNgay", v); }} aria-label="Từ ngày" />
            <span aria-hidden="true">–</span>
            <DateInput id="rp-to" className="catalog-input" value={f.denNgay} min={f.tuNgay} onChange={(v) => { if (/^\d{4}-\d{2}-\d{2}$/.test(v)) set("denNgay", v); }} aria-label="Đến ngày" />
          </div>
          {overviewTab ? (
            <label className="s1-compare"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> So với kỳ trước</label>
          ) : null}
          {tab === "doanh-thu" ? (
            <select id="rp-period" className="catalog-input rp-select" value={f.period} onChange={(e) => set("period", e.target.value as RevenuePeriod)} aria-label="Chu kỳ">
              <option value="DAY">Theo ngày</option>
              <option value="WEEK">Theo tuần</option>
              <option value="MONTH">Theo tháng</option>
              <option value="YEAR">Theo năm</option>
            </select>
          ) : null}
          {tab === "san-pham" ? (
            <>
              <select id="rp-type" className="catalog-input rp-select" value={f.loaiTop} onChange={(e) => set("loaiTop", e.target.value as TopType)} aria-label="Loại">
                <option value="BEST_SELLER">Bán chạy</option>
                <option value="SLOW_MOVING">Bán chậm</option>
              </select>
              <select id="rp-topn" className="catalog-input rp-select rp-select-sm" value={String(f.topN)} onChange={(e) => set("topN", Number(e.target.value))} aria-label="Số lượng hiển thị">
                {[5, 10, 20, 50, 100].map((n) => <option key={n} value={n}>Top {n}</option>)}
              </select>
            </>
          ) : null}
          {tab === "xuat-nhap-ton" ? (
            <>
              <input id="rp-month" className="catalog-input rp-month" type="month" value={f.thang ? `${f.thang.slice(3)}-${f.thang.slice(0, 2)}` : ""} onChange={(e) => { const v = e.target.value; set("thang", v ? `${v.slice(5, 7)}-${v.slice(0, 4)}` : ""); }} aria-label="Tháng, để trống là tháng hiện tại" />
              <input id="rp-sku" className="catalog-input rp-sku" value={skuInput} onChange={(e) => setSkuInput(e.target.value)} placeholder="SKU" aria-label="SKU" />
            </>
          ) : null}
        </div>
      </div>
      {rangeError ? <p className="catalog-error" role="alert">{rangeError}</p> : null}
      {csvError ? <p className="catalog-error" role="alert">{csvError}</p> : null}
      <div id="report-panel" role="tabpanel" aria-labelledby={`report-tab-${tab}`} aria-busy={loading} className={`rp-panel${loading && ready ? " is-loading" : ""}`}>
        {overviewTab && !rangeError ? <ReportOverview from={f.tuNgay} to={f.denNgay} compare={compare} onOpenTab={(t) => setTab(t)} /> : null}
        {!overviewTab && failure ? (
          <div ref={errorRef} tabIndex={-1} className="order-empty" role="alert">
            <strong>Không tải được Report</strong>
            <p>{failure.message}</p>
            <button className="secondary" type="button" onClick={load}>Thử lại</button>
          </div>
        ) : null}
        {!overviewTab && !failure && !ready && !rangeError ? <ReportSkeleton tab={tab} /> : null}
        {!overviewTab && !failure && ready ? (
          <>
            {ready.doanhThu ? <DoanhThuView data={ready.doanhThu} from={ready.from} to={ready.to} period={ready.period} onPreset={(id) => { const p = PRESETS.find((x) => x.id === id); if (p) { const [a, b] = p.range(); setF((prev) => ({ ...prev, tuNgay: a, denNgay: b, page: 0 })); } }} /> : null}
            {ready.sanPham ? <SanPhamView data={ready.sanPham} loai={ready.sanPhamType ?? "BEST_SELLER"} /> : null}
            {ready.xnt ? <XntView data={ready.xnt} page={f.page ?? 0} onPage={(n) => set("page", n)} /> : null}
          </>
        ) : null}
      </div>
    </AdminShellB>
  );
}

function ReportSkeleton({ tab }: { tab: Tab }) {
  return (
    <div aria-hidden="true">
      {tab === "doanh-thu" ? <div className="kpi-row rp-kpis"><CardSkeleton height={84} /><CardSkeleton height={84} /><CardSkeleton height={84} /></div> : null}
      <TableSkeleton rows={8} columns={tab === "xuat-nhap-ton" ? 6 : 4} />
    </div>
  );
}

function useChartHeight() {
  const [h, setH] = useState(300);
  useEffect(() => {
    const on = () => setH(window.innerWidth < 1000 ? 260 : Math.max(240, Math.min(520, window.innerHeight - 410)));
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return h;
}

function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="order-empty rp-empty"><strong>{title}</strong>{children}</div>;
}

function DoanhThuView({ data, from, to, period, onPreset }: { data: RevenueResult; from: string; to: string; period: RevenuePeriod; onPreset: (id: string) => void }) {
  const chartH = useChartHeight();
  const g = period as Granularity;
  const filled = useMemo(() => fillPeriods({
    from, to, granularity: g,
    rows: data.timeline.map((p) => ({ date: p.date, value: p.revenue, count: p.orders })),
  }), [data.timeline, from, to, g]);
  const cogs = data.summary.totalCogs as number | null | undefined;
  const profit = data.summary.grossProfit as number | null | undefined;
  const avg = data.summary.averageOrderValue;
  const hasData = data.timeline.length > 0 && data.summary.totalOrders > 0;
  const noteHint = `Doanh thu tính từ hóa đơn đã thu, không gồm ${data.coverage.excludedPending ?? "?"} đơn chờ và đơn hủy/chưa thu.${cogs == null && profit == null ? " Giá vốn và lãi gộp chưa có dữ liệu nên không hiển thị." : ""}`;
  return (
    <>
      <div className="kpi-row rp-kpis" aria-label="Tổng hợp">
        <div className="kpi-card kpi-green"><span className="kpi-label">Tổng thu</span><span className="kpi-value"><Num tone="green" money bold value={data.summary.totalRevenue} /></span></div>
        <div className="kpi-card kpi-blue"><span className="kpi-label">Số đơn đã thu</span><span className="kpi-value"><Num tone="blue" value={data.summary.totalOrders} /></span></div>
        <div className="kpi-card kpi-violet"><span className="kpi-label">Trung bình/đơn</span><span className="kpi-value"><Num tone="violet" money value={avg === null || avg === undefined ? null : Math.round(avg)} /></span></div>
        {cogs != null ? <div className="kpi-card"><span className="kpi-label">Vốn hàng bán</span><span className="kpi-value"><Num money value={cogs} /></span></div> : null}
        {profit != null ? <div className="kpi-card kpi-green"><span className="kpi-label">Lãi gộp</span><span className="kpi-value"><Num tone="green" money value={profit} /></span></div> : null}
      </div>
      {!hasData ? (
        <section className="form-card rp-card">
          <Empty title="Chưa có doanh thu trong kỳ này">
            <p>Không có hóa đơn đã thu từ {dmy(from)} đến {dmy(to)}. Thử chọn kỳ dài hơn.</p>
            <div className="rp-empty-actions"><button className="secondary" type="button" onClick={() => onPreset("30")}>Xem 30 ngày gần nhất</button><button className="secondary" type="button" onClick={() => onPreset("month")}>Tháng này</button></div>
          </Empty>
        </section>
      ) : (
        <div className="rp-grid">
          <section className="form-card rp-card rp-chart" aria-label="Biểu đồ doanh thu">
            <div className="rp-card-head"><h2>Doanh thu theo {PERIOD_TITLE[period]}</h2><InfoHint align="start">{noteHint}</InfoHint></div>
            <BarChart title={`Doanh thu theo ${PERIOD_TITLE[period]}`} data={filled} tone="green" height={chartH} formatValue={moneyText} countUnit="đơn" valueHeader="Doanh thu" />
          </section>
          <section className="form-card rp-card rp-table" aria-label="Bảng doanh thu">
            <div className="table-scroll rp-scroll" tabIndex={0} aria-label="Bảng doanh thu theo kỳ">
              <table className="review-orders-table l3-table rp-rev-table" data-testid="rev-table">
                <caption className="sr-only">Doanh thu theo kỳ, cùng số liệu với biểu đồ</caption>
                <thead><tr><th>Kỳ</th><th className="num">Số đơn</th><th className="num">Doanh thu</th></tr></thead>
                <tbody>
                  {filled.map((r) => (
                    <tr key={r.key}>
                      <td data-label="Kỳ" className="tabnum">{periodTitle(r.key, g)}</td>
                      <td data-label="Số đơn" className="num"><Num tone="blue" value={r.count ?? 0} /></td>
                      <td data-label="Doanh thu" className="num"><Num tone="green" money value={r.value} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function SanPhamView({ data, loai }: { data: TopProductRow[]; loai: TopType }) {
  const best = loai === "BEST_SELLER";
  const bars = useMemo(() => data.map((r) => ({
    key: `${r.rank}-${r.productId}`,
    label: r.productName,
    value: best ? r.totalQuantitySold : r.currentInventory ?? 0,
    tooltip: best
      ? `${r.productName} · ${formatNumber(r.totalQuantitySold)} đã bán · ${moneyText(r.totalRevenue)}`
      : `${r.productName} · tồn ${r.currentInventory === null ? "chưa có" : formatNumber(r.currentInventory)} · không bán trong kỳ`,
  })), [data, best]);
  if (data.length === 0) return <section className="form-card rp-card"><Empty title={best ? "Chưa có sản phẩm bán được trong kỳ này" : "Không có sản phẩm bán chậm trong kỳ này"}><p>Thử chọn kỳ dài hơn hoặc đổi loại.</p></Empty></section>;
  return (
    <div className="rp-grid rp-grid-top">
      <section className="form-card rp-card rp-chart" aria-label={best ? "Biểu đồ bán chạy" : "Biểu đồ bán chậm"}>
        <div className="rp-card-head"><h2>{best ? "Số lượng bán" : "Tồn hiện tại"}</h2></div>
        <HBarChart title={best ? "Sản phẩm bán chạy" : "Sản phẩm bán chậm"} tone={best ? "blue" : "gray"} data={bars} formatValue={(v) => formatNumber(v)} />
      </section>
      <section className="form-card rp-card rp-table" aria-label="Bảng sản phẩm">
        <div className="table-scroll rp-scroll" tabIndex={0} aria-label={best ? "Top bán chạy" : "Bán chậm"}>
          <table className="review-orders-table l3-table">
            <caption className="sr-only">{best ? "Sản phẩm bán chạy" : "Sản phẩm bán chậm"} · {formatNumber(data.length)} dòng</caption>
            <thead><tr><th className="num rp-rank">Hạng</th><th>Sản phẩm</th><th>Danh mục</th><th className="num">SL bán</th><th className="num">Doanh thu</th><th className="num">Tồn</th></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={`${r.rank}-${r.productId}`}>
                  <td data-label="Hạng" className="num rp-rank tabnum">{r.rank}</td>
                  <td data-label="Sản phẩm" className="cell-title"><span className="rp-clip" title={r.productName}>{r.productName}</span></td>
                  <td data-label="Danh mục">{r.categoryName ?? <span className="empty-value">Chưa có</span>}</td>
                  <td data-label="SL bán" className="num"><Num tone="blue" value={r.totalQuantitySold} /></td>
                  <td data-label="Doanh thu" className="num"><Num tone="green" money value={r.totalRevenue} /></td>
                  <td data-label="Tồn" className="num">{r.currentInventory === null ? <span className="empty-value">Chưa có</span> : <Num tone={r.currentInventory <= 0 ? "red" : "green"} dimZero={false} value={r.currentInventory} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function XntView({ data, page, onPage }: { data: MovementResult; page: number; onPage: (n: number) => void }) {
  if (data.items.length === 0) return <section className="form-card rp-card"><Empty title="Không có SKU khớp"><p>Thử đổi khoảng ngày, tháng hoặc SKU.</p></Empty></section>;
  return (
    <section className="form-card rp-card rp-xnt" aria-label="Xuất nhập tồn">
      <div className="table-scroll rp-scroll" tabIndex={0} aria-label="Bảng xuất nhập tồn">
        <table className="review-orders-table l3-table">
          <caption className="sr-only">Biến động trong tháng · tồn cuối là số khả dụng hiện tại</caption>
          <thead><tr><th>SKU</th><th>Sản phẩm</th><th className="num">Nhập</th><th className="num">Xuất bán</th><th className="num">Hỏng</th><th className="num">Tồn cuối</th></tr></thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.skuId}>
                <td data-label="SKU" className="tabnum">{r.skuId}</td>
                <td data-label="Sản phẩm" className="cell-title">
                  <span className="rp-clip" title={r.productName}>{r.productName}</span>
                  <small className="meta">{[r.color, r.size].filter(Boolean).join(" · ") || "Chưa có màu/cỡ"}{r.barcode ? ` · ${r.barcode}` : ""}</small>
                </td>
                <td data-label="Nhập" className="num">{r.totalImport === null ? <span className="empty-value">—</span> : <Num tone="green" value={r.totalImport} />}</td>
                <td data-label="Xuất bán" className="num"><Num tone="orange" value={r.totalSold} /></td>
                <td data-label="Hỏng" className="num">{r.totalDamaged === null ? <span className="empty-value">—</span> : <Num tone="red" value={r.totalDamaged} />}</td>
                <td data-label="Tồn cuối" className="num">{r.closingStock === null ? <span className="empty-value">—</span> : <Num tone={r.closingStock <= 0 ? "red" : "green"} dimZero={false} bold value={r.closingStock} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={data.totalPages} total={data.totalElements} unit="SKU" onPage={onPage} />
    </section>
  );
}
