import Link from "next/link";
import { Icon } from "@/components/admin-b/icons";
import { AdminShellB } from "@/components/admin-b/admin-shell";

export default function AuditUnavailablePage() {
  return <AdminShellB active="audit" title="Nhật ký hệ thống" eyebrow="Hệ thống">
    <div className="page-heading"><div><h1>Nhật ký hệ thống</h1><p className="meta">Bản này chưa ghi lại hoạt động.</p></div></div>
    <div className="order-empty" role="status">
      <strong><Icon name="triangle-alert" /> Bản này chưa có nhật ký hoạt động</strong>
      <p>Hệ thống chưa lưu lại các thao tác thêm, sửa hoặc xóa, nên chưa có danh sách để xem.</p>
      <Link className="secondary" href="/quan-tri">Về Dashboard</Link>
    </div>
  </AdminShellB>;
}
