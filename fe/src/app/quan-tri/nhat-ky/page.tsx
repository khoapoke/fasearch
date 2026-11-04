import Link from "next/link";
import { Icon } from "@/components/admin-b/icons";
import { AdminShellB } from "@/components/admin-b/admin-shell";

// CONTROL-SCOPE-CLARIFICATIONS #3: BE không có endpoint nhật ký audit; trang cũ render shell A
// và gắn nhãn LIVE trong khi mọi fetch v1/admin/nhat-ky đều thất bại. Trạng thái trung thực trong
// shell B, không fetch, không nhãn LIVE, không thêm module audit.
export default function AuditUnavailablePage() {
  return <AdminShellB active="reports" title="Nhật ký hệ thống">
    <div className="page-heading"><div><h1>Nhật ký hệ thống</h1><p className="meta">Máy chủ chưa cung cấp nhật ký · không có dữ liệu live</p></div></div>
    <div className="order-empty" role="status">
      <strong><Icon name="triangle-alert" /> Chưa có nhật ký từ máy chủ</strong>
      <p>BE chưa có endpoint nhật ký kiểm toán, nên trang này không hiển thị danh sách vết Thêm/Sửa/Xóa. Không có chính sách lưu trữ hay nội dung sự kiện nào được suy đoán ở đây.</p>
      <Link className="text-link" href="/quan-tri">Về Tổng quan</Link>
    </div>
  </AdminShellB>;
}
