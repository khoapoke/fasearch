"use client";

import Link from "next/link";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { PREVIEW_ORDERS, orderStatusLabel } from "@/lib/preview-data";
import { formatVnd } from "@/components/storefront/product-card";
import { stitchImages } from "@/lib/stitch-assets";
import "@/components/storefront/listing.css";

export function HubContent() {
  const wish = stitchImages("fashionsearch_ai_s_n_ph_m_y_u_th_ch").slice(0, 4);
  return (
    <AccountCenterShell active="/tai-khoan" kicker="FASHION AI PROFILE HUB" title="Trung Tâm Quản Lý Tài Khoản">
      <div className="sfSideCard">
        <p className="sfIdentitySub" role="note">
          Đơn hàng và mục yêu thích dưới đây là dữ liệu minh họa cho bản xem trước; hồ sơ
          và bảo mật của bạn vẫn kết nối máy chủ. <Link href="/don-hang">Xem trang đơn hàng →</Link>
        </p>
      </div>
      {PREVIEW_ORDERS.slice(0, 1).map((o) => (
        <section className="sfSideCard" key={o.id} aria-label={`Đơn ${o.id}`}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <b>Mã đơn: #{o.id}</b>
            <span className="pMatch">{orderStatusLabel(o.status)}</span>
            <span className="pPrice" style={{ marginLeft: "auto" }}>{formatVnd(o.total)}</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }} aria-label="Tiến trình đơn">
            {["Mới tạo", "Đã xác nhận", "Đóng gói", "Đang giao hàng", "Hoàn thành"].map((s, i) => (
              <div key={s} style={{ flex: 1, textAlign: "center", fontSize: 11 }}>
                <div style={{
                  height: 6, borderRadius: 999,
                  background: i < 4 ? "var(--accent)" : "var(--line)",
                }} />
                <p style={{ marginTop: 5, fontWeight: i === 3 ? 700 : 400, color: i === 3 ? "var(--brand)" : undefined }}>{s}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <Link className="hmCta hmCtaGhost" href="/don-hang" style={{ padding: "10px 16px", fontSize: 13 }}>Theo dõi hành trình</Link>
            <Link className="hmCta hmCtaPrimary" href="/don-hang" style={{ padding: "10px 16px", fontSize: 13 }}>Mua lại đơn này</Link>
          </div>
        </section>
      ))}
      <section className="sfSideCard" aria-label="Sản phẩm yêu thích đã lưu">
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <b>♡ Sản Phẩm Yêu Thích Đã Lưu</b>
          <Link href="/yeu-thich" style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>Xem tất cả →</Link>
        </div>
        <div className="pgGrid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 12 }}>
          {wish.map((w, i) => (
            <div key={i} className="pCard">
              <span className="pCardMedia">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.src} alt={w.alt || "Sản phẩm yêu thích"} loading="lazy" referrerPolicy="no-referrer" />
              </span>
              <div className="pCardBody">
                <span className="pPrice" style={{ fontSize: 13.5 }}>{formatVnd(159000 + i * 40000)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="sfSideCard" aria-label="Lịch sử tìm kiếm AI">
        <b>Lịch Sử Tìm Kiếm AI &amp; Phân Tích Trang Phục</b>
        <p className="sfIdentitySub">Từ khóa AI tìm gần nhất: “áo thun oversize nam đen”, “quần short chạy bộ có túi zip”.</p>
        <p style={{ marginTop: 10 }}><Link href="/lich-su-ai" style={{ fontWeight: 700, color: "var(--accent)", fontSize: 13 }}>Mở lịch sử AI →</Link></p>
      </section>
    </AccountCenterShell>
  );
}
