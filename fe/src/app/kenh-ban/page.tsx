"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { readOwnIdentity, type AccountIdentity } from "@/components/account/account-session";
import { beFetch, unwrap, type Page } from "@/lib/mgmt-client";
import { PREVIEW_ORDERS, orderStatusLabel } from "@/lib/preview-data";
import { formatVnd } from "@/components/storefront/product-card";

const HOURS = ["08h", "10h", "12h", "14h", "16h", "18h", "20h", "22h"];
const HOURLY = [12, 28, 45, 38, 62, 84, 71, 40];

type Counts = { cats: number | null; prods: number | null; error: string };

export default function MerchantDashboard() {
  const [me, setMe] = useState<AccountIdentity | null>(null);
  const [counts, setCounts] = useState<Counts>({ cats: null, prods: null, error: "" });

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
    return () => {
      live = false;
    };
  }, []);

  const greeting =
    me?.role === "ADMIN" ? "Chào Quản Trị" : me?.role === "STAFF" ? "Chào Nhân Viên" : "Chào Bạn";

  return (
    <MerchantShell
      active="dashboard"
      previewNote="Dashboard kênh bán: hai thẻ đếm lấy từ catalog công khai; doanh thu, đơn hàng và biểu đồ là minh họa (máy chủ chưa có API thống kê)."
    >
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>{greeting} 👋</h1>
      <p className="mpMuted">
        {me ? `Phiên ${me.role} · ` : "Chưa đăng nhập · "}
        Hôm nay · 7 ngày qua · Tháng này — dữ liệu minh họa trừ hai thẻ đếm máy chủ.
        Số liệu vận hành chi tiết cần STAFF/ADMIN.
      </p>

      <div className="mpStats" style={{ marginTop: 14 }}>
        <div className="mpStat">
          <p>Danh mục (máy chủ)</p>
          {counts.error ? (
            <b role="alert" style={{ fontSize: 15, color: "#ba1a1a" }}>Lỗi tải</b>
          ) : (
            <b>{counts.cats ?? "…"}</b>
          )}
          <small>GET /catalog/danh-muc</small>
        </div>
        <div className="mpStat">
          <p>Sản phẩm (máy chủ)</p>
          {counts.error ? (
            <b role="alert" style={{ fontSize: 15, color: "#ba1a1a" }}>Lỗi tải</b>
          ) : (
            <b>{counts.prods ?? "…"}</b>
          )}
          <small>GET /catalog/san-pham</small>
        </div>
        <div className="mpStat"><p>Doanh thu hôm nay (minh họa)</p><b>48,2tr</b><small>+12,4% hôm qua</small></div>
        <div className="mpStat"><p>Đơn hàng (minh họa)</p><b>132</b><small>Hoả tốc: 18</small></div>
      </div>
      {counts.error ? (
        <p className="mpPreviewBar" role="alert">Không tải được số liệu máy chủ: {counts.error} Các thẻ minh họa bên dưới không bị ảnh hưởng.</p>
      ) : null}
      {counts.cats === 0 || counts.prods === 0 ? (
        <p className="mpPreviewBar" role="status">Catalog máy chủ đang trống — hai thẻ đếm hiện 0 là số liệu thật, không phải lỗi.</p>
      ) : null}

      <div className="mpCard">
        <h2>Doanh thu theo giờ trong ngày <span className="mpPill mpPillWarn">Minh họa</span></h2>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 150, marginTop: 14 }} role="img" aria-label="Biểu đồ doanh thu minh họa">
          {HOURLY.map((v, i) => (
            <div key={HOURS[i]} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ height: `${v}%`, minHeight: 8, borderRadius: 7, background: "linear-gradient(180deg, var(--accent), var(--brand))" }} />
              <small className="mpMuted">{HOURS[i]}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="mpCard">
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <h2>Đơn hàng gần đây <span className="mpPill mpPillWarn">Minh họa</span></h2>
          <Link href="/kenh-ban/don-hang" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>Quản lý đơn hàng →</Link>
        </div>
        <div className="mpTableWrap">
          <table className="mpTable">
            <thead>
              <tr><th>Mã đơn</th><th>Khách hàng</th><th>Tổng tiền</th><th>Thanh toán</th><th>Trạng thái</th></tr>
            </thead>
            <tbody>
              {PREVIEW_ORDERS.map((o) => (
                <tr key={o.id}>
                  <td><b>#{o.id}</b></td>
                  <td>Khách lẻ #{o.id.slice(-4)}</td>
                  <td><b>{formatVnd(o.total)}</b></td>
                  <td><span className="mpPill">COD</span></td>
                  <td><span className="mpPill mpPillLive">{orderStatusLabel(o.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mpCard">
        <h2>Hiệu quả AI Search trong ngày <span className="mpPill mpPillWarn">Minh họa</span></h2>
        <p className="mpMuted">Tỉ lệ khớp mẫu 98,2% · thời gian quét 0,45s — số liệu minh họa từ bản thiết kế, không phải đo lường thật.</p>
      </div>
    </MerchantShell>
  );
}
