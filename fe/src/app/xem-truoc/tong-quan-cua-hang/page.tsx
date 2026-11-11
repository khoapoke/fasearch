"use client";

import Link from "next/link";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { PREVIEW_ORDERS, orderStatusLabel } from "@/lib/preview-data";
import { formatVnd } from "@/components/storefront/product-card";

// Biến thể dashboard thứ hai trong source (Store Admin Dashboard).
// Preview tách riêng; dashboard kênh bán thường nằm ở /kenh-ban.
export default function StoreDashboardVariant() {
  return (
    <MerchantShell
      active="dashboard"
      previewNote="Biến thể dashboard thứ hai trong source (preview tách riêng) — route dashboard thường là /kenh-ban. Không có số liệu thật nào ở trang này."
    >
      <div className="mpCard">
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <h2>Dashboard Quản Lý &amp; Vận Hành</h2>
          <Link className="mpTopBtn" style={{ marginLeft: "auto" }} href="/kenh-ban">Về dashboard kênh bán →</Link>
        </div>
        <p className="mpMuted">Biến thể trình bày thứ hai trong source. Mọi số liệu là minh họa.</p>
      </div>
      <div className="mpStats" aria-label="Chỉ số minh họa">
        <div className="mpStat"><p>Doanh thu (VNĐ, minh họa)</p><b>86,4tr</b><small>Hôm nay</small></div>
        <div className="mpStat"><p>Số lượng đơn (minh họa)</p><b>148</b><small>Chờ xác nhận: 6</small></div>
        <div className="mpStat"><p>Đang đóng gói (minh họa)</p><b>14</b><small>kho Tân Bình</small></div>
        <div className="mpStat"><p>Đang giao (minh họa)</p><b>8</b><small>Hoả tốc: 3</small></div>
      </div>
      <div className="mpCard">
        <h2>Bảng Đơn Hàng Gần Đây <span className="mpPill mpPillWarn">Minh họa</span></h2>
        <div className="mpTableWrap">
          <table className="mpTable">
            <thead>
              <tr><th>Mã đơn hàng</th><th>Khách hàng</th><th>Kênh</th><th>Sản phẩm tóm tắt</th><th>Tổng tiền</th><th>Thanh toán</th><th>Trạng thái</th><th style={{ textAlign: "right" }}>Thao tác</th></tr>
            </thead>
            <tbody>
              {PREVIEW_ORDERS.map((o) => (
                <tr key={o.id}>
                  <td><b>#{o.id}</b></td>
                  <td>Khách lẻ #{o.id.slice(-4)}</td>
                  <td><span className="mpPill">Website</span></td>
                  <td>{o.items} món</td>
                  <td><b>{formatVnd(o.total)}</b></td>
                  <td>COD</td>
                  <td><span className="mpPill mpPillLive">{orderStatusLabel(o.status)}</span></td>
                  <td style={{ textAlign: "right" }}><span className="mpMuted">Xử lý (preview)</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MerchantShell>
  );
}
