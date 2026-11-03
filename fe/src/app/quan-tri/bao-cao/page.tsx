"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import "@/components/admin/admin.css";
import {
  downloadReportCsv, fetchProducts, fetchRevenue, fetchXnt,
  type DoanhThuResult, type SanPhamResult, type XntResult,
} from "@/lib/reports-client";
import { buildReportQuery, reportCsvName, type ReportChannel, type ReportFilters } from "@/lib/reports";

type Tab = "doanh-thu" | "san-pham" | "xuat-nhap-ton";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; tab: Tab; doanhThu?: DoanhThuResult; sanPham?: SanPhamResult; xnt?: XntResult }
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
  const [f, setF] = useState<ReportFilters>({ tuNgay: monthStart(), denNgay: today(), kenhBan: "ALL", maKho: "", sku: "", topN: 10, ngayCham: "" });
  const [state, setState] = useState<State>({ kind: "idle" });
  const [csvBusy, setCsvBusy] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  function filtersFor(t: Tab): ReportFilters {
    const base: ReportFilters = { tuNgay: f.tuNgay, denNgay: f.denNgay };
    if (t === "doanh-thu") return { ...base, kenhBan: f.kenhBan };
    if (t === "san-pham") return { ...base, topN: f.topN, ngayCham: f.ngayCham };
    return { ...base, maKho: f.maKho, sku: f.sku, page: f.page, size: f.size };
  }

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const scoped = filtersFor(tab);
      const q = buildReportQuery(scoped);
      if (tab === "doanh-thu") setState({ kind: "ready", tab, doanhThu: await fetchRevenue(q) });
      else if (tab === "san-pham") setState({ kind: "ready", tab, sanPham: await fetchProducts(q) });
      else setState({ kind: "ready", tab, xnt: await fetchXnt(q) });
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
  }, [tab, f.tuNgay, f.denNgay, f.kenhBan, f.maKho, f.sku, f.topN, f.ngayCham]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  function set<K extends keyof ReportFilters>(k: K, v: ReportFilters[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function csv() {
    setCsvBusy(true);
    try {
      const q = buildReportQuery({ ...filtersFor(tab), page: 0, size: 5000 });
      await downloadReportCsv(tab, q, reportCsvName(tab, f.tuNgay, f.denNgay));
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setState({ kind: "error", status: st, message: e instanceof Error ? e.message : "Tải CSV thất bại." });
    } finally {
      setCsvBusy(false);
    }
  }

  const ready = state.kind === "ready" && state.tab === tab ? state : null;

  return (
    <AdminShellB active="reports" title="Báo cáo doanh thu & hàng hóa" eyebrow="Quản trị">
      <p className="adLede">Số liệu từ hóa đơn đã thu thật. Chi phí lịch sử chưa rõ và tồn đầu kỳ chưa rõ hiện cảnh báo, không tính 0.</p>
      <div className="adActions" style={{ margin: "0 0 16px" }}><button className="adBtn adBtnPrimary" type="button" disabled={csvBusy || !ready} onClick={csv}>{csvBusy ? "Đang xuất…" : "Xuất CSV (cùng bộ lọc)"}</button></div>
      <div className="adFilters" role="group" aria-label="Loại báo cáo" style={{ marginBottom: 12 }}>
        {(["doanh-thu", "san-pham", "xuat-nhap-ton"] as Tab[]).map((t) => (
          <button key={t} className="adBtn" type="button" aria-pressed={tab === t} onClick={() => setTab(t)} style={tab === t ? { background: "#4338ca", borderColor: "#4338ca", color: "#fff" } : undefined}>
            {t === "doanh-thu" ? "Doanh thu & lãi gộp" : t === "san-pham" ? "Sản phẩm bán chạy" : "Xuất–nhập–tồn"}
          </button>
        ))}
      </div>
      <section className="adCard" aria-label="Bộ lọc">
        <form className="adFilters" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <label>Từ ngày <input type="date" value={f.tuNgay} onChange={(e) => set("tuNgay", e.target.value)} aria-label="Từ ngày" /></label>
          <label>Đến ngày <input type="date" value={f.denNgay} onChange={(e) => set("denNgay", e.target.value)} aria-label="Đến ngày" /></label>
          {tab === "doanh-thu" ? (
            <select value={f.kenhBan} onChange={(e) => set("kenhBan", e.target.value as ReportChannel)} aria-label="Kênh">
              <option value="ALL">Mọi kênh</option>
              <option value="ONLINE">Online</option>
              <option value="POS">POS</option>
            </select>
          ) : null}
          {tab === "xuat-nhap-ton" ? (
            <>
              <input value={f.maKho ?? ""} onChange={(e) => set("maKho", e.target.value)} placeholder="Mã kho" aria-label="Mã kho" style={{ width: 100 }} />
              <input value={f.sku ?? ""} onChange={(e) => set("sku", e.target.value)} placeholder="Mã SKU" aria-label="Mã SKU" style={{ width: 120 }} />
            </>
          ) : null}
          {tab === "san-pham" ? (
            <>
              <input value={String(f.topN ?? 10)} onChange={(e) => set("topN", Number(e.target.value))} aria-label="TopN" inputMode="numeric" style={{ width: 80 }} />
              <input value={f.ngayCham ?? ""} onChange={(e) => set("ngayCham", e.target.value)} placeholder="Số ngày chậm" aria-label="Số ngày chậm" inputMode="numeric" style={{ width: 120 }} />
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
          {ready.sanPham ? <SanPhamView data={ready.sanPham} /> : null}
          {ready.xnt ? <XntView data={ready.xnt} /> : null}
        </div>
      ) : null}
    </AdminShellB>
  );
}

function DoanhThuView({ data }: { data: DoanhThuResult }) {
  const tongThu = data.rows.reduce((n, r) => n + (r.tongThu || 0), 0);
  const tongLoi = data.rows.reduce((n, r) => n + (r.loiGop || 0), 0);
  const thieuVon = data.rows.reduce((n, r) => n + (r.dongThieuVon || 0), 0);
  if (data.rows.length === 0) return <p className="adState">Không có dòng nào với bộ lọc hiện tại (tập rỗng hợp lệ).</p>;
  return (
    <>
      {data.ghiChuBaoPhu ? <p className="adNote" role="note">{data.ghiChuBaoPhu}</p> : null}
      <section className="adStats" aria-label="Tổng hợp">
        <div className="adStat"><small>Tổng thu</small><b>{fmtMoney(tongThu)}</b></div>
        <div className="adStat"><small>Tổng lãi gộp</small><b>{fmtMoney(tongLoi)}</b></div>
        <div className="adStat"><small>Dòng thiếu vốn</small><b>{thieuVon}</b></div>
      </section>
      <section className="adCard" aria-label="Theo ngày">
        <div className="adTableWrap">
          <table className="adTable">
            <thead><tr><th>Ngày</th><th>Số đơn</th><th>Tổng thu</th><th>Giảm voucher</th><th>Giảm điểm</th><th>Phí ship</th><th>Vốn hàng bán</th><th>Lãi gộp</th><th>Dòng thiếu vốn</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.ngay}>
                  <td className="adMono">{r.ngay}</td>
                  <td>{r.soDon}</td>
                  <td>{fmtMoney(r.tongThu)}</td>
                  <td>{fmtMoney(r.giamVoucher)}</td>
                  <td>{fmtMoney(r.giamDiem)}</td>
                  <td>{fmtMoney(r.phiVanChuyen)}</td>
                  <td>{fmtMoney(r.vonHangBan)}</td>
                  <td>{fmtMoney(r.loiGop)}</td>
                  <td>{r.dongThieuVon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function SanPhamView({ data }: { data: SanPhamResult }) {
  if (data.top.length === 0 && data.banCham.length === 0 && data.chuaTungBan.length === 0) {
    return <p className="adState">Không có dòng nào với bộ lọc hiện tại (tập rỗng hợp lệ).</p>;
  }
  const table = (title: string, rows: SanPhamResult["top"]) => (
    <section className="adCard" aria-label={title}>
      <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{title}</h2>
      {rows.length === 0 ? <p className="adState">Không có dòng nào.</p> : (
        <div className="adTableWrap">
          <table className="adTable">
            <thead><tr><th>Mã SP</th><th>Tên (snapshot)</th><th>SL bán</th><th>Doanh thu</th><th>Đã xóa</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.maSp}>
                  <td className="adMono">{r.maSp}</td>
                  <td>{r.tenSp}</td>
                  <td>{r.soLuongBan}</td>
                  <td>{fmtMoney(r.doanhThu)}</td>
                  <td>{r.daXoa ? "Đã xóa" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
  return (
    <>
      {data.ghiChuBaoPhu ? <p className="adNote" role="note">{data.ghiChuBaoPhu}</p> : null}
      {table("Top bán chạy (doanh thu sau giảm, hòa thứ tự theo mã SP ASC)", data.top)}
      {table("Bán chậm (có tồn nhưng không bán trong window)", data.banCham)}
      {table("Chưa từng bán", data.chuaTungBan)}
    </>
  );
}

function XntView({ data }: { data: XntResult }) {
  if (data.rows.length === 0) return <p className="adState">Không có dòng nào với bộ lọc hiện tại (tập rỗng hợp lệ).</p>;
  return (
    <>
      {data.ghiChuBaoPhu ? <p className="adNote" role="note">{data.ghiChuBaoPhu}</p> : null}
      {(data.skuTonDauUnknown?.length ?? 0) > 0 ? (
        <p className="adNote" role="note" style={{ borderLeft: "4px solid #d97706", paddingLeft: 10 }}>
          Tồn đầu chưa rõ (legacy/không movement): SKU {data.skuTonDauUnknown!.join(", ")} — không bịa từ tồn hiện tại.
        </p>
      ) : null}
      <section className="adCard" aria-label="Xuất nhập tồn">
        <div className="adTableWrap">
          <table className="adTable">
            <thead><tr><th>SKU</th><th>Kho</th><th>Tồn đầu</th><th>Nhập</th><th>Xuất</th><th>Điều chỉnh</th><th>Tồn cuối</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={`${r.maSku}-${r.maKho}`}>
                  <td className="adMono">{r.maSku}{r.tonDauUnknown ? " (đầu chưa rõ)" : ""}</td>
                  <td className="adMono">{r.maKho}</td>
                  <td>{r.tonDau}</td>
                  <td>{r.nhap}</td>
                  <td>{r.xuat}</td>
                  <td>{r.dieuChinh}</td>
                  <td><b>{r.tonCuoi}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
