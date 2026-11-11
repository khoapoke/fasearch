"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { CustomerForm } from "@/components/admin-b/customer-form";
import { DeleteReasonPanel } from "@/components/admin-b/delete-reason-panel";
import { CardSkeleton } from "@/components/admin-b/skeleton";
import { Num } from "@/components/admin-b/status-badge";
import { TierBadge } from "@/components/admin-b/tier";
import { useToast } from "@/components/admin-b/toast";
import { InfoHint } from "@/components/admin-b/info-hint";
import { PointsAdjustModal } from "@/components/admin-b/points-adjust-modal";
import { PointsHistory } from "@/components/admin-b/points-history";
import { useAdminCan } from "@/components/admin-b/use-admin-role";
import { deleteCustomer, getCustomer, type Customer } from "@/lib/admin-customer-client";
export default function AdminCustomerDetailPage() {
  const { id } = useParams<{ id: string }>(); const can = useAdminCan(); const router = useRouter(); const toast = useToast();
  const [c, setC] = useState<Customer | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false); const [historyKey, setHistoryKey] = useState(0);
  const [deleting, setDeleting] = useState(false); const [deleteIssue, setDeleteIssue] = useState(""); const [deleteBusy, setDeleteBusy] = useState(false);
  useEffect(() => { const ctrl = new AbortController(); getCustomer(id, ctrl.signal).then(setC).catch((e) => { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được khách hàng."); }).finally(() => { if (!ctrl.signal.aborted) setLoading(false); }); return () => ctrl.abort(); }, [id]);
  async function confirmDelete(reason: string) {
    if (deleteBusy) return;
    setDeleteBusy(true); setDeleteIssue("");
    try { await deleteCustomer(id, reason); toast.success("Đã chuyển khách hàng vào thùng rác."); router.push("/quan-tri/khach-hang"); return; }
    catch (e) { setDeleteIssue(e instanceof Error && e.message ? e.message : "Không xóa được khách hàng. Thử lại."); }
    finally { setDeleteBusy(false); }
  }
  const displayName = c ? [c.firstName, c.lastName].filter(Boolean).join(" ") || c.lastName : "Khách hàng";
  return <AdminShellB active="customers" title="Chi tiết khách hàng">
    <div className="page-head pd-head">
      <div className="page-head-title"><div className="l3-title-stack"><Link className="back-link" href="/quan-tri/khach-hang">← Khách hàng</Link><h1>{displayName}</h1></div></div>
      {c && can("CUSTOMER_DELETE") ? <div className="page-head-actions"><button className="danger" type="button" disabled={deleteBusy} onClick={() => { setDeleteIssue(""); setDeleting(true); }}>Xóa khách hàng</button></div> : null}
    </div>
    <DeleteReasonPanel
      open={deleting}
      title="Xóa hồ sơ khách hàng này?"
      target={displayName}
      consequence="Hồ sơ được ẩn khỏi danh sách và chuyển vào thùng rác; dữ liệu không bị xóa vĩnh viễn và khôi phục được ở mục Thùng rác. Khách đã có đơn hàng, hóa đơn, bút toán điểm hoặc phiếu đổi trả sẽ bị từ chối. Hồ sơ có tài khoản đăng nhập liên kết chỉ Quản trị viên hệ thống xóa được — khi đó tài khoản bị khóa và khôi phục hồ sơ không tự mở khóa."
      busy={deleteBusy}
      refusal={deleteIssue}
      onClose={() => { if (!deleteBusy) { setDeleting(false); setDeleteIssue(""); } }}
      onConfirm={(reason) => void confirmDelete(reason)}
    />
    {loading ? <div className="form-layout"><CardSkeleton height={320} /><CardSkeleton height={160} /></div> : null}
    {error ? <div className="order-empty" role="alert"><strong>Không tải được khách hàng</strong><p>{error}</p><Link className="secondary" href="/quan-tri/khach-hang">Về danh sách</Link></div> : null}
    {c ? <div className="form-layout">
      <div className="form-main"><section className="form-card"><h2>Thông tin liên hệ</h2>
        <fieldset className="o1-fieldset" disabled={!can("CUSTOMER_EDIT")} title={can("CUSTOMER_EDIT") ? undefined : "Chưa được bật quyền sửa khách hàng"}><CustomerForm key={`${c.id}:${c.lastName}:${c.phoneNumber}:${c.address ?? ""}`} mode="edit" customer={c} onSaved={(saved) => { setC(saved); toast.success("Đã lưu hồ sơ khách hàng."); }} /></fieldset>
      </section></div>
      <div className="form-side"><section className="form-card"><h2 className="l3-card-title">Hạng và điểm <InfoHint>Hạng và điểm do hệ thống tính từ đơn hàng, không sửa tại đây.</InfoHint></h2>
        <dl className="l3-stats">
          <div><dt>Hạng</dt><dd><TierBadge name={c.tierName} /></dd></div>
          <div><dt>Điểm tích lũy</dt><dd className="l3-big"><Num value={c.accumulatePoint ?? 0} tone="amber" /></dd></div>
        </dl>
        {can("LOYALTY_ADJUST") ? <button className="secondary pts-adjust-btn" type="button" onClick={() => setAdjusting(true)}>Điều chỉnh điểm</button> : null}
      </section></div>
    </div> : null}
    {c && can("CUSTOMER_VIEW") ? <section className="form-card pts-card" aria-labelledby="pts-history-title">
      <div className="pts-card-head"><h2 id="pts-history-title">Lịch sử điểm <InfoHint>Mỗi dòng là một bút toán không sửa hay xóa được. Điều chỉnh sai thì ghi một điều chỉnh mới ngược lại.</InfoHint></h2></div>
      <PointsHistory customerId={id} refreshKey={historyKey} />
    </section> : null}
    {c && can("LOYALTY_ADJUST") ? <PointsAdjustModal open={adjusting} customerId={id} customerName={displayName} balance={c.accumulatePoint ?? 0}
      onClose={() => setAdjusting(false)}
      onDone={(r) => { setC({ ...c, accumulatePoint: r.balanceAfter ?? c.accumulatePoint }); setHistoryKey((k) => k + 1); setAdjusting(false); }} /> : null}
  </AdminShellB>;
}
