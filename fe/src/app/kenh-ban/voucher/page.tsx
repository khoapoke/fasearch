import Link from "next/link";
import { MerchantShell } from "@/components/merchant/merchant-shell";

export default function MerchantVouchers() {
  return <MerchantShell active="vouchers" previewNote="Quản lý chiến dịch và mã phát hành thuộc Admin.">
    <div className="mpCard">
      <h2>Ưu đãi &amp; voucher</h2>
      <p className="mpMuted">S1 chỉ cấp API quản lý cho ADMIN và không công bố danh sách mã cho nhân viên. Không hiển thị dữ liệu mẫu hay suy đoán lượt dùng.</p>
      <p className="mpMuted"><Link href="/quan-tri/khuyen-mai">Mở quản trị khuyến mãi →</Link> (quyền được máy chủ kiểm tra lại).</p>
    </div>
  </MerchantShell>;
}
