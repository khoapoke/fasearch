"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { EmployeeForm } from "@/components/admin-b/employee-form";
import { InfoHint } from "@/components/admin-b/info-hint";
export default function NewEmployeePage() {
  const router = useRouter();
  return <AdminShellB active="employees" title="Tạo hồ sơ nhân sự"><div className="page-head pd-head"><div className="page-head-title"><div className="l3-title-stack"><Link className="back-link" href="/quan-tri/nhan-vien">← Nhân sự</Link><h1>Tạo hồ sơ nhân sự</h1></div></div></div><div className="form-layout"><div className="form-main"><section className="form-card"><h2 className="l3-card-title">Thông tin hồ sơ <InfoHint>CCCD đầy đủ chỉ hiện ở biểu mẫu và trang chi tiết; danh sách chỉ hiện 4 số cuối. Có thể liên kết tài khoản nội bộ ngay hoặc sau (chỉ Quản trị viên). Xóa hồ sơ là chuyển vào thùng rác và khóa tài khoản liên kết; hồ sơ đã liên kết tài khoản chỉ Quản trị viên xóa được.</InfoHint></h2><EmployeeForm mode="create" leaving onSaved={(e) => router.push(`/quan-tri/nhan-vien/${e.id}`)} onCancel={() => router.push("/quan-tri/nhan-vien")} /></section></div></div></AdminShellB>;
}
