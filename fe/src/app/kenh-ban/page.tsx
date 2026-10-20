"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { readOwnIdentity, type AccountIdentity } from "@/components/account/account-session";
import { beFetch, unwrap, type Page } from "@/lib/mgmt-client";
import { fetchStaffOrders } from "@/lib/commerce-client";
import { orderStatusLabel } from "@/lib/commerce";
import { fetchRevenue } from "@/lib/reports-client";
import { formatVnd } from "@/components/storefront/product-card";
import { formatVndContract } from "@/lib/commerce";

type Counts = { cats: number | null; prods: number | null; error: string };
type AiStatus = { ready: boolean; eligibleImageCount?: number; datasetVersion?: string };
type StaffOrder = {
  maDonHang: number;
  trangThai: string;
  tongThanhToan: number | null;
  trangThaiThanhToan?: string;
  sdtNhan?: string | null;
  ngayDat?: string;
};

function todayRange(): string {
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `tuNgay=${day}&denNgay=${day}`;
}

// Dashboard chỉ dùng số liệu thật từ API: catalog, đơn hàng, báo cáo doanh thu
// (ADMIN) và trạng thái tìm kiếm AI. Không vẽ biểu đồ/số liệu minh họa.
export default function MerchantDashboard() {
  const [me, setMe] = useState<AccountIdentity | null>(null);
  const [counts, setCounts] = useState<Counts>({ cats: null, prods: null, error: "" });
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState<number | null>(null);
  const [ordersError, setOrdersError] = useState("");
  const [revenueToday, setRevenueToday] = useState<number | null>(null);
  const [revenueNote, setRevenueNote] = useState("");
  const [ai, setAi] = useState<AiStatus | null>(null);

  useEffect(() => {
    let live = true;
    readOwnIdentity()
      .then((identity) => live && setMe(identity))
      .catch(() => {});
    Promise.all([
      beFetch("v1/catalog/danh-muc").then((r) => unwrap<Array<unknown>>(r)),
      beFetch("v1/catalog/san-pham?page=0&size=1").then((r) => unwrap<Page<unknown>>(r)),
    ])
      .then(([c, p]) => {
        if (live) setCounts({ cats: c.length, prods: p.totalElements, error: "" });
      })
      .catch((e: Error) => {
        if (live) setCounts({ cats: null, prods: null, error: e.message || "Không tải được số liệu máy chủ." });
      });
    fetchStaffOrders("page=0&size=5")
      .then((pg) => {
        if (!live) return;
        setOrders(pg.data as StaffOrder[]);
        setOrdersTotal(pg.totalElements);
        setOrdersError("");
      })
      .catch((e) => {
        if (!live) return;
        const status = (e as { status?: number })?.status ?? 0;
        setOrdersError(
          status === 403
            ? "Tài khoản này không có quyền xem đơn hàng (cần STAFF/ADMIN)."
            : "Không tải được danh sách đơn hàng.",
        );
      });
    beFetch("v1/ai/status")
      .then(async (r) => {
        if (!r.ok || !live) return;
        const payload = (await r.json()) as { result?: AiStatus };
        if (payload?.result && live) setAi(payload.result);
      })
      .catch(() => {});
    fetchRevenue(todayRange())
      .then((r) => {
        if (!live) return;
        const total = r.rows.reduce((sum, row) => sum + (row.tongThu ?? 0), 0);
        setRevenueToday(total);
        setRevenueNote(r.ghiChuBaoPhu ?? "");
      })
      .catch((e) => {
        if (!live) return;
        const status = (e as { status?: number })?.status ?? 0;
        if (status !== 403) setRevenueNote("Không tải được báo cáo doanh thu.");
      });
    return () => {
      live = false;
    };
  }, []);

  const greeting =
    me?.role === "ADMIN" ? "Chào quản trị" : me?.role === "STAFF" ? "Chào nhân viên" : "Chào bạn";

  return (
    <MerchantShell
      active="dashboard"
      previewNote="Số liệu dưới đây lấy thẳng từ máy chủ: catalog, đơn hàng, báo cáo doanh thu (ADMIN) và trạng thái tìm kiếm AI."
    >
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>{greeting}</h1>
      <p className="mpMuted">
        {me ? `Phiên ${me.role}` : "Chưa đăng nhập"} · số liệu theo ngày hôm nay.
      </p>

      <div className="mpStats" style={{ marginTop: 14 }}>
        <div className="mpStat">
          <p>Danh mục</p>
          {counts.error ? (
            <b role="alert" style={{ fontSize: 15, color: "#ba1a1a" }}>Lỗi tải</b>
          ) : (
            <b>{counts.cats ?? "…"}</b>
          )}
          <small>GET /catalog/danh-muc</small>
        </div>
        <div className="mpStat">
          <p>Sản phẩm</p>
          {counts.error ? (
            <b role="alert" style={{ fontSize: 15, color: "#ba1a1a" }}>Lỗi tải</b>
          ) : (
            <b>{counts.prods ?? "…"}</b>
          )}
          <small>GET /catalog/san-pham</small>
        </div>
        <div className="mpStat">
          <p>Đơn hàng</p>
          <b>{ordersTotal ?? "…"}</b>
          <small>GET /quan-tri/don-hang</small>
        </div>
        <div className="mpStat">
          <p>Doanh thu hôm nay</p>
          <b>{revenueToday === null ? (me?.role === "ADMIN" ? "…" : "—") : formatVnd(revenueToday)}</b>
          <small>{me?.role === "ADMIN" ? "GET /bao-cao/doanh-thu" : "Cần quyền ADMIN"}</small>
        </div>
      </div>
      {counts.error ? (
        <p className="mpPreviewBar" role="alert">Không tải được số liệu danh mục/sản phẩm: {counts.error}</p>
      ) : null}
      {me?.role === "ADMIN" && revenueNote ? (
        <p className="mpPreviewBar" role="note">{revenueNote}</p>
      ) : null}

      <div className="mpCard">
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <h2>Đơn hàng gần đây</h2>
          <Link href="/kenh-ban/don-hang" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>Quản lý đơn hàng →</Link>
        </div>
        {ordersError ? (
          <p className="mpMuted" role="alert" style={{ marginTop: 10 }}>{ordersError}</p>
        ) : null}
        {!ordersError && orders.length === 0 ? (
          <p className="mpMuted" style={{ marginTop: 10 }}>Chưa có đơn hàng nào trên hệ thống.</p>
        ) : null}
        {orders.length > 0 ? (
          <div className="mpTableWrap">
            <table className="mpTable">
              <thead>
                <tr><th>Mã đơn</th><th>Khách hàng</th><th>Tổng tiền</th><th>Thanh toán</th><th>Trạng thái</th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.maDonHang}>
                    <td><b>#{o.maDonHang}</b></td>
                    <td>{o.sdtNhan ? o.sdtNhan : "—"}</td>
                    <td><b>{formatVndContract(o.tongThanhToan)}</b></td>
                    <td><span className="mpPill">{o.trangThaiThanhToan === "DA_THANH_TOAN" ? "Đã thu" : "Chưa thu"}</span></td>
                    <td><span className="mpPill mpPillLive">{orderStatusLabel(o.trangThai)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="mpCard">
        <h2>Tìm kiếm AI</h2>
        {ai ? (
          <p className="mpMuted">
            {ai.ready ? "Sẵn sàng" : "Chưa sẵn sàng"}
            {ai.eligibleImageCount ? ` · ${ai.eligibleImageCount.toLocaleString("vi-VN")} ảnh trong bộ dữ liệu` : ""}
            {ai.datasetVersion ? ` · phiên bản dữ liệu ${ai.datasetVersion}` : ""}
          </p>
        ) : (
          <p className="mpMuted" role="status">Đang kiểm tra trạng thái tìm kiếm AI…</p>
        )}
        <p className="mpMuted" style={{ marginTop: 6 }}>
          Kết quả tìm kiếm AI là ảnh trong bộ dữ liệu, chưa phải mã sản phẩm bán được.
        </p>
      </div>
    </MerchantShell>
  );
}
