"use client";

import { MerchantShell } from "@/components/merchant/merchant-shell";

const MONTHS = ["T5", "T6", "T7", "T8", "T9", "T10"];
const REV = [38, 52, 47, 66, 74, 91];
const PROFIT = [12, 18, 15, 24, 27, 33];

export default function ReportsPage() {
  return (
    <MerchantShell
      active="reports"
      previewNote="Báo cáo thống kê preview: toàn bộ số liệu và biểu đồ là minh họa, máy chủ chưa có API thống kê/doanh thu."
    >
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>Phân Tích &amp; Doanh Thu Thời Gian Thực</h1>
      <p className="mpMuted">Hôm nay · Tuần này · Tháng này · Quý này</p>
      <div className="mpStats" style={{ marginTop: 14 }}>
        <div className="mpStat"><p>Doanh thu tháng (minh họa)</p><b>1,24 tỷ</b><small>+18% cùng kỳ</small></div>
        <div className="mpStat"><p>Lợi nhuận (minh họa)</p><b>386tr</b><small>biên 31%</small></div>
        <div className="mpStat"><p>Đơn hoàn thành (minh họa)</p><b>2.148</b><small>tỉ lệ hủy 1,2%</small></div>
        <div className="mpStat"><p>Giá trị TB/đơn (minh họa)</p><b>578K</b><small>+4,1%</small></div>
      </div>
      <div className="mpCard">
        <h2>Biến động doanh thu &amp; lợi nhuận theo thời gian <span className="mpPill mpPillWarn">Minh họa</span></h2>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-end", height: 170, marginTop: 14 }} role="img" aria-label="Biểu đồ doanh thu minh họa">
          {MONTHS.map((m, i) => (
            <div key={m} style={{ flex: 1, textAlign: "center", display: "flex", gap: 5, alignItems: "flex-end", justifyContent: "center", height: "100%" }}>
              <div style={{ flex: 1, height: `${REV[i]}%`, borderRadius: 7, background: "linear-gradient(180deg, var(--accent), var(--brand))" }} title={`Doanh thu ${m}`} />
              <div style={{ flex: 1, height: `${PROFIT[i]}%`, borderRadius: 7, background: "#c7d2fe" }} title={`Lợi nhuận ${m}`} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {MONTHS.map((m) => <small key={m} className="mpMuted" style={{ flex: 1, textAlign: "center" }}>{m}</small>)}
        </div>
      </div>
      <div className="mpCard">
        <h2>Khuyến nghị Tài chính &amp; Vận hành <span className="mpPill mpPillWarn">Minh họa</span></h2>
        <p className="mpMuted">Tăng tồn kho size L nhóm Compact trước mùa lễ; xem xét thanh lý 3 SKU tồn đọng dưới đây bằng voucher thay vì giảm giá sâu.</p>
      </div>
      <div className="mpCard">
        <h2>Top 3 mặt hàng bán chạy nhất <span className="mpPill mpPillWarn">Minh họa</span></h2>
        <p className="mpMuted">Áo Thun Compact Đen · Quần Short 7 inch · Polo Pique Trắng</p>
        <h2 style={{ marginTop: 14 }}>Top 3 sản phẩm tồn đọng cần thanh lý <span className="mpPill mpPillWarn">Minh họa</span></h2>
        <p className="mpMuted">Xem danh sách tồn minh họa ở trang nhập kho.</p>
      </div>
    </MerchantShell>
  );
}
