"use client";

import Link from "next/link";
import { MerchantShell } from "@/components/merchant/merchant-shell";

export default function ReportsPage() {
  return (
    <MerchantShell
      active="reports"
      previewNote="Báo cáo doanh thu & hàng hóa do quản trị viên xem ở khu vực quản trị."
    >
      <div className="mpCard">
        <h2>Báo Cáo Thống Kê</h2>
        <p className="mpMuted">
          Số liệu báo cáo (doanh thu, lãi gộp, sản phẩm, xuất–nhập–tồn) chỉ hiển thị
          cho tài khoản ADMIN ở <Link href="/quan-tri/bao-cao">Báo cáo quản trị →</Link>
        </p>
      </div>
    </MerchantShell>
  );
}
