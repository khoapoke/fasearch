"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { DeleteReasonPanel } from "@/components/admin-b/delete-reason-panel";
import { EmployeeForm } from "@/components/admin-b/employee-form";
import { deleteEmployee, getEmployee, genderLabel, roleLabel, type Employee } from "@/lib/admin-people-client";
import { useAdminRole, useAdminCan } from "@/components/admin-b/use-admin-role";
import { formatDate } from "@/lib/admin-format";
import { CardSkeleton } from "@/components/admin-b/skeleton";
import { InfoHint } from "@/components/admin-b/info-hint";
import { StatusBadge } from "@/components/admin-b/status-badge";
import { useToast } from "@/components/admin-b/toast";

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>(); const id = typeof params.id === "string" ? params.id : ""; const router = useRouter(); const toast = useToast(); const currentRole = useAdminRole(); const can = useAdminCan(); const [employee, setEmployee] = useState<Employee | null>(null); const [error, setError] = useState(""); const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false); const [deleteIssue, setDeleteIssue] = useState(""); const [deleteBusy, setDeleteBusy] = useState(false);
  const adminLinked = employee?.role === "ADMIN";
  const staffBlocked = currentRole === "STAFF" && adminLinked;
  useEffect(() => { if (!id) return; const c = new AbortController(); getEmployee(id, c.signal).then(setEmployee).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được hồ sơ nhân sự."); }); return () => c.abort(); }, [id]);
  async function confirmDelete(reason: string) {
    if (!employee || deleteBusy) return;
    setDeleteBusy(true); setDeleteIssue("");
    try { await deleteEmployee(employee.id, reason); toast.success("Đã chuyển hồ sơ vào thùng rác."); router.push("/quan-tri/nhan-vien"); return; }
    catch (e) { setDeleteIssue(e instanceof Error && e.message ? e.message : "Không xóa được hồ sơ nhân sự. Thử lại."); }
    finally { setDeleteBusy(false); }
  }
  const displayName = employee ? ([employee.firstName, employee.lastName].filter(Boolean).join(" ") || `Hồ sơ ${employee.id}`) : "Hồ sơ nhân sự";
  return <AdminShellB active="employees" title="Chi tiết hồ sơ nhân sự">
    <div className="page-head pd-head">
      <div className="page-head-title"><div className="l3-title-stack"><Link className="back-link" href="/quan-tri/nhan-vien">← Nhân sự</Link><h1>{displayName}</h1></div></div>
      {employee && !staffBlocked && (can("EMPLOYEE_EDIT") || can("EMPLOYEE_DELETE")) ? <div className="page-head-actions">{can("EMPLOYEE_EDIT") ? <button className="primary" type="button" disabled={deleteBusy || editing} onClick={() => setEditing(true)}>Sửa hồ sơ</button> : null}{can("EMPLOYEE_DELETE") ? <button className="danger" type="button" disabled={deleteBusy} onClick={() => { setDeleteIssue(""); setDeleting(true); }}>Xóa hồ sơ</button> : null}</div> : null}
    </div>
    <DeleteReasonPanel
      open={deleting}
      title="Xóa hồ sơ nhân sự này?"
      target={employee ? `${displayName}${employee.username ? ` · ${employee.username}` : ""}` : ""}
      consequence="Hồ sơ được ẩn khỏi danh sách và chuyển vào thùng rác; dữ liệu không bị xóa vĩnh viễn và khôi phục được ở mục Thùng rác. Tài khoản đăng nhập liên kết (nếu có) bị khóa và khôi phục hồ sơ không tự mở khóa — hồ sơ đã liên kết tài khoản chỉ Quản trị viên hệ thống xóa được."
      busy={deleteBusy}
      refusal={deleteIssue}
      onClose={() => { if (!deleteBusy) { setDeleting(false); setDeleteIssue(""); } }}
      onConfirm={(reason) => void confirmDelete(reason)}
    />
    {error ? <div className="order-empty" role="alert"><strong>Không tải được hồ sơ nhân sự</strong><p>{error}</p><button className="secondary" onClick={() => location.reload()}>Thử lại</button></div> : null}
    {!employee && !error ? <div className="form-layout"><CardSkeleton height={260} /><CardSkeleton height={120} /></div> : null}
    {employee ? <div className="form-layout">
      <div className="form-main">
        {!editing ? <section className="form-card"><h2 className="l3-card-title">Thông tin hồ sơ <InfoHint>CCCD đầy đủ chỉ hiện ở trang chi tiết và biểu mẫu; danh sách chỉ hiện 4 số cuối.</InfoHint></h2><dl className="detail-grid"><div><dt>Điện thoại</dt><dd className="tabnum">{employee.phoneNumber}</dd></div><div><dt>CCCD</dt><dd className="tabnum">{employee.cccd}</dd></div><div><dt>Giới tính</dt><dd>{employee.gender ? genderLabel(employee.gender) : <span className="empty-value">Chưa cập nhật</span>}</dd></div><div><dt>Ngày sinh</dt><dd>{employee.dob ? formatDate(employee.dob) : <span className="empty-value">Chưa cập nhật</span>}</dd></div><div><dt>Địa chỉ</dt><dd>{employee.address ?? <span className="empty-value">Chưa cập nhật</span>}</dd></div></dl></section> : null}
        {editing && !staffBlocked ? <section className="form-card"><h2>Sửa hồ sơ</h2><EmployeeForm mode="edit" employee={employee} onSaved={(e) => { setEmployee(e); setEditing(false); toast.success("Đã lưu hồ sơ nhân sự."); router.refresh(); }} onCancel={() => setEditing(false)} /></section> : null}
        {editing && staffBlocked ? <div className="order-empty" role="alert"><strong>Không có quyền sửa hồ sơ này</strong><p>Quản lý không sửa được hồ sơ của Quản trị viên hệ thống.</p><button className="secondary" type="button" onClick={() => setEditing(false)}>Quay lại chi tiết</button></div> : null}
      </div>
      <div className="form-side"><section className="form-card"><h2>Tài khoản liên kết</h2>
        {employee.username ? <dl className="l3-stats"><div><dt>Tên đăng nhập</dt><dd>{employee.username}</dd></div><div><dt>Vai trò</dt><dd><StatusBadge status="ROLE" tone={employee.role === "ADMIN" ? "violet" : "blue"} label={roleLabel(employee.role)} /></dd></div></dl> : <p className="empty-value">Chưa liên kết</p>}
        {staffBlocked ? <p className="meta" role="note">Hồ sơ của Quản trị viên hệ thống; Quản lý không có quyền sửa hay xóa.</p> : null}
      </section></div>
    </div> : null}
  </AdminShellB>;
}
