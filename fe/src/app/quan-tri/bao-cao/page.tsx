"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import "@/components/admin/admin.css";
import {
  downloadCsv, fetchMovement, fetchRevenue, fetchTopProducts,
  type MovementResult, type RevenueResult, type TopProductRow,
} from "@/lib/reports-client";
import {
  buildMovementQuery, buildRevenueQuery, buildTopQuery, normalizeTopN, reportCsvName,
  type ReportFilters, type RevenuePeriod, type TopType,
} from "@/lib/reports";

type Tab = "doanh-thu" | "san-pham" | "xuat-nhap-ton";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; tab: Tab; doanhThu?: RevenueResult; sanPham?: TopProductRow[]; sanPhamType?: TopType; xnt?: MovementResult }
  | { kind: "error"; message: string; status: number };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStart(): string {
  return new Date().toISOString().slice(0, 7) + "-01";
}

function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "Chưa rõ";
  return `${v.toLocaleString("vi-VN")}₫`;
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("doanh-thu");
  const [f, setF] = useState<ReportFilters & { topN: number; loaiTop: TopType; thang: string }>({
    tuNgay: monthStart(), denNgay: today(), period: "DAY", type: "BEST_SELLER", limit: 10, topN: 10, loaiTop: "BEST_SELLER", thang: "",
    sku: "", page: 0, size: 20,
  });
  const [state, setState] = useState<State>({ kind: "idle" });
  const [csvBusy, setCsvBusy] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      if (tab === "doanh-thu") {
        const q = buildRevenueQuery({ tuNgay: f.tuNgay, denNgay: f.denNgay, period: f.period });
        setState({ kind: "ready", tab, doanhThu: await fetchRevenue(q) });
      } else if (tab === "san-pham") {
        const q = buildTopQuery({ tuNgay: f.tuNgay, denNgay: f.denNgay, type: f.loaiTop, limit: normalizeTopN(f.topN) });
        setState({ kind: "ready", tab, sanPham: await fetchTopProducts(q), sanPhamType: f.loaiTop });
      } else {
        const q = buildMovementQuery({ tuNgay: f.tuNgay, denNgay: f.denNgay, page: f.page, size: f.size, month: f.thang, sku: f.sku });
        setState({ kind: "ready", tab, xnt: await fetchMovement(q) });
      }
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setState({
        kind: "error",
        status: st,
        message: st === 401 ? "Phiên đăng nhập đã hết. Đăng nhập lại." : st === 403 ? "Tài khoản không có quyền xem báo cáo (ADMIN)." : e instanceof Error ? e.message : "Không tải được báo cáo.",
      });
      setTimeout(() => errorRef.current?.focus(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, f.tuNgay, f.denNgay, f.period, f.loaiTop, f.topN, f.thang, f.sku, f.page]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  const ready = state.kind === "ready" && state.tab === tab ? state : null;

  async function csv() {
    if (!ready) return;
    setCsvBusy(true);
    try {
      const name = reportCsvName(tab === "san-pham" ? "san-pham" : tab, f.tuNgay, f.denNgay);
      if (tab === "doanh-thu" && ready.doanhThu) {
        downloadCsv(name, ["Ngay", "SoDon", "DoanhThu"],
          ready.doanhThu.timeline.map((r) => [r.date, r.orders, r.revenue]));
      } else if (tab === "san-pham" && ready.sanPham) {
        downloadCsv(name, ["Hang", "MaSP", "TenSP", "DanhMuc", "SLBan", "DoanhThu", "TonHienTai"],
          ready.sanPham.map((r) => [r.rank, r.productId, r.productName, r.categoryName ?? "", r.totalQuantitySold, r.totalRevenue, r.currentInventory ?? ""]));
      } else if (tab === "xuat-nhap-ton" && ready.xnt) {
        downloadCsv(name, ["SKU", "TenSP", "Mau", "Co", "Barcode", "TonDau", "Nhap", "Ban", "Hong", "TonCuoi"],
          ready.xnt.items.map((r) => [r.skuId, r.productName, r.color ?? "", r.size ?? "", r.barcode ?? "", r.openingStock ?? "Chua ro", r.totalImport, r.totalSold, r.totalDamaged, r.closingStock ?? ""]));
      }
    } catch (e) {
      setState({ kind: "error", status: 0, message: e instanceof Error ? e.message : "Tải CSV thất bại." });
    } finally {
      setCsvBusy(false);
    }
  }

  return (
    <AdminShellB active="reports" title="Báo cáo doanh thu & hàng hóa" eyebrow="Quản trị">
      <p className="adLede">Số liệu từ hóa đơn đã thu thật. Chi phí lịch sử chưa rõ và tồn đầu kỳ chưa rõ hiện cảnh báo, không tính 0.</p>
      <div className="adActions" style={{ margin: "0 0 16px" }}><button className="adBtn adBtnPrimary" type="button" disabled={csvBusy || !ready} onClick={csv}>{csvBusy ? "Đang xuất…" : "Xuất CSV (dữ liệu bảng đang xem)"}</button></div>
      <div className="adFilters" role="group" aria-label="Loại báo cáo" style={{ marginBottom: 12 }}>
        {(["doanh-thu", "san-pham", "xuat-nhap-ton"] as Tab[]).map((t) => (
          <button key={t} className="adBtn" type="button" aria-pressed={tab === t} onClick={() => setTab(t)} style={tab === t ? { background: "#4338ca", borderColor: "#4338ca", color: "#fff" } : undefined}>
            {t === "doanh-thu" ? "Doanh thu & lãi gộp" : t === "san-pham" ? "Sản phẩm bán chạy/chậm" : "Xuất–nhập–tồn"}
          </button>
        ))}
      </div>
      <section className="adCard" aria-label="Bộ lọc">
        <form className="adFilters" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <label>Từ ngày <input type="date" value={f.tuNgay} onChange={(e) => set("tuNgay", e.target.value)} aria-label="Từ ngày" /></label>
          <label>Đến ngày <input type="date" value={f.denNgay} onChange={(e) => set("denNgay", e.target.value)} aria-label="Đến ngày" /></label>
          {tab === "doanh-thu" ? (
            <>
              <label>Chu kỳ{" "}
                <select value={f.period} onChange={(e) => set("period", e.target.value as RevenuePeriod)} aria-label="Chu kỳ">
                  <option value="DAY">Ngày</option>
                  <option value="WEEK">Tuần</option>
                  <option value="MONTH">Tháng</option>
                  <option value="YEAR">Năm</option>
                </select>
              </label>
              <span className="adNote">Kênh: mọi kênh (duy nhất được hỗ trợ — schema không có cột kênh).</span>
            </>
          ) : null}
          {tab === "san-pham" ? (
            <>
              <label>Loại{" "}
                <select value={f.loaiTop} onChange={(e) => set("loaiTop", e.target.value as TopType)} aria-label="Loại top">
                  <option value="BEST_SELLER">Bán chạy</option>
                  <option value="SLOW_MOVING">Bán chậm (không bán trong window)</option>
                </select>
              </label>
              <label>Top <input value={String(f.topN)} onChange={(e) => set("topN", Number(e.target.value))} aria-label="Top N" inputMode="numeric" style={{ width: 80 }} /></label>
            </>
          ) : null}
          {tab === "xuat-nhap-ton" ? (
            <>
              <label>Tháng <input type="month" value={f.thang ? `${f.thang.slice(3)}-${f.thang.slice(0, 2)}` : ""} onChange={(e) => { const v = e.target.value; set("thang", v ? `${v.slice(5, 7)}-${v.slice(0, 4)}` : ""); }} aria-label="Tháng (MM-YYYY)" /></label>
              <label>Mã SKU <input value={f.sku ?? ""} onChange={(e) => set("sku", e.target.value)} placeholder="Mã SKU" aria-label="Mã SKU" style={{ width: 120 }} /></label>
            </>
          ) : null}
          <button className="adBtn" type="submit">Lọc (giữ điều kiện)</button>
        </form>
      </section>
      {state.kind === "loading" ? <p className="adState" role="status">Đang tải báo cáo…</p> : null}
      {state.kind === "error" ? (
        <div ref={errorRef} tabIndex={-1} className="adCard" role="alert">
          <p className="adNote">{state.message}</p>
          <button className="adBtn" type="button" onClick={load}>Thử lại (giữ lọc)</button>
        </div>
      ) : null}
      {ready ? (
        <div key={tab} className="fade-swap">
          {ready.doanhThu ? <DoanhThuView data={ready.doanhThu} /> : null}
          {ready.sanPham ? <SanPhamView data={ready.sanPham} loai={ready.sanPhamType ?? "BEST_SELLER"} /> : null}
          {ready.xnt ? <XntView data={ready.xnt} page={f.page ?? 0} onPage={(n) => setF((p) => ({ ...p, page: n }))} /> : null}
        </div>
      ) : null}
    </AdminShellB>
  );
}

function DoanhThuView({ data }: { data: RevenueResult }) {
  const max = Math.max(1, ...data.timeline.map((r) => r.revenue));
  return (
    <>
      <p className="adNote" role="note">
        Doanh thu = tổng hóa đơn đã thu (PAID), loại {data.coverage.excludedPending ?? "?"} đơn chờ
        và đơn hủy/chưa thu; tồn kho/coGS không có lịch sử nên Vốn và Lãi gộp hiện “Chưa rõ”, không tính 0.
      </p>
      <section className="adStats" aria-label="Tổng hợp">
        <div className="adStat"><small>Tổng thu</small><b>{fmtMoney(data.summary.totalRevenue)}</b></div>
        <div className="adStat"><small>Số đơn đã thu</small><b>{data.summary.totalOrders}</b></div>
        <div className="adStat"><small>Trung bình/đơn</small><b>{fmtMoney(data.summary.averageOrderValue)}</b></div>
        <div className="adStat"><small>Vốn hàng bán</small><b>{fmtMoney(data.summary.totalCogs)}</b></div>
        <div className="adStat"><small>Lãi gộp</small><b>{fmtMoney(data.summary.grossProfit)}</b></div>
      </section>
      {data.timeline.length === 0 ? <p className="adState">Không có dòng nào với bộ lọc hiện tại (tập rỗng hợp lệ).</p> : (
        <section className="adCard" aria-label="Diễn biến theo kỳ">
          <div className="adChart" role="img" aria-label={`Biểu đồ doanh thu ${data.timeline.length} kỳ, cùng số liệu bảng bên dưới`}>
            {data.timeline.map((r) => (
              <div className="adBar" key={r.date} title={`${r.date}: ${fmtMoney(r.revenue)} (${r.orders} đơn)`}>
                <span style={{ height: `${Math.max(2, Math.round((r.revenue / max) * 100))}%` }} />
                <em>{r.date.slice(5)}</em>
              </div>
            ))}
          </div>
          <div className="adTableWrap">
            <table className="adTable">
              <caption>Doanh thu theo kỳ (cùng số liệu với biểu đồ)</caption>
              <thead><tr><th>Kỳ</th><th>Số đơn</th><th>Doanh thu</th></tr></thead>
              <tbody>
                {data.timeline.map((r) => (
                  <tr key={r.date}><td className="adMono">{r.date}</td><td>{r.orders}</td><td>{fmtMoney(r.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function SanPhamView({ data, loai }: { data: TopProductRow[]; loai: TopType }) {
  if (data.length === 0) return <p className="adState">Không có dòng nào với bộ lọc hiện tại (tập rỗng hợp lệ).</p>;
  return (
    <section className="adCard" aria-label={loai === "BEST_SELLER" ? "Bán chạy" : "Bán chậm"}>
      {loai === "SLOW_MOVING" ? (
        <p className="adNote" role="note">Bán chậm = có hàng nhưng không bán trong window đã chọn (ghi nhận rõ, không đoán số 0).</p>
      ) : (
        <p className="adNote" role="note">Xếp hạng theo dòng hóa đơn đã thu; sản phẩm đã xóa mềm giữ tên snapshot và được gắn cờ.</p>
      )}
      <div className="adTableWrap">
        <table className="adTable">
          <caption>{loai === "BEST_SELLER" ? "Top bán chạy" : "Bán chậm"}</caption>
          <thead><tr><th>Hạng</th><th>Mã SP</th><th>Tên (snapshot)</th><th>Danh mục</th><th>SL bán</th><th>Doanh thu</th><th>Tồn hiện tại</th></tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={`${r.rank}-${r.productId}`}>
                <td>{r.rank}</td>
                <td className="adMono">{r.productId}</td>
                <td>{r.productName}</td>
                <td>{r.categoryName ?? "—"}</td>
                <td>{r.totalQuantitySold}</td>
                <td>{fmtMoney(r.totalRevenue)}</td>
                <td>{r.currentInventory === null ? "Chưa rõ" : r.currentInventory}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function XntView({ data, page, onPage }: { data: MovementResult; page: number; onPage: (n: number) => void }) {
  return (
    <>
      <p className="adNote" role="note">
        Tồn đầu kỳ <b>không tính được</b> (schema không có lịch sử kho/mở đầu) nên hiện “Chưa đủ dữ liệu” —
        không bịa từ tồn hiện tại. Tồn cuối là ảnh chụp hiện tại, khác với biến động trong kỳ.
      </p>
      {data.items.length === 0 ? <p className="adState">Không có dòng nào với bộ lọc hiện tại (tập rỗng hợp lệ).</p> : (
        <section className="adCard" aria-label="Xuất nhập tồn">
          <div className="adTableWrap">
            <table className="adTable">
              <thead><tr><th>SKU</th><th>Sản phẩm</th><th>Màu/Cỡ</th><th>Barcode</th><th>Tồn đầu</th><th>Nhập</th><th>Bán</th><th>Hỏng</th><th>Tồn cuối (ảnh chụp)</th></tr></thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.skuId}>
                    <td className="adMono">{r.skuId}</td>
                    <td>{r.productName}</td>
                    <td>{[r.color, r.size].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="adMono">{r.barcode ?? "—"}</td>
                    <td>Chưa đủ dữ liệu</td>
                    <td>{r.totalImport}</td>
                    <td>{r.totalSold}</td>
                    <td>{r.totalDamaged}</td>
                    <td><b>{r.closingStock === null ? "Chưa rõ" : r.closingStock}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.totalPages > 1 ? (
            <nav className="adPager" aria-label="Phân trang tồn kho">
              <button className="adBtn" type="button" disabled={page <= 0} onClick={() => onPage(Math.max(0, page - 1))}>Trang trước</button>
              <span>Trang {page + 1}/{data.totalPages} — {data.totalElements} SKU</span>
              <button className="adBtn" type="button" disabled={page + 1 >= data.totalPages} onClick={() => onPage(page + 1)}>Trang sau</button>
            </nav>
          ) : null}
        </section>
      )}
    </>
  );
}
