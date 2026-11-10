"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { AdminModal } from "@/components/admin-b/modal";
import { EmployeeForm } from "@/components/admin-b/employee-form";
import { PageHeader } from "@/components/admin-b/page-header";
import { Pager } from "@/components/admin-b/pagination";
import { RowLink } from "@/components/admin-b/row-link";
import { TableSkeleton } from "@/components/admin-b/skeleton";
import { StatusBadge } from "@/components/admin-b/status-badge";
import { useToast } from "@/components/admin-b/toast";
import { useAdminCan } from "@/components/admin-b/use-admin-role";
import { getEmployeePage, maskCccd, roleLabel, type Employee, type Page } from "@/lib/admin-people-client";

export default function EmployeesPage() {
  const toast = useToast(); const can = useAdminCan();
  const [data, setData] = useState<Page<Employee> | null>(null); const [page, setPage] = useState(0); const [keyword, setKeyword] = useState(""); const [term, setTerm] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState(false); const [nonce, setNonce] = useState(0);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    const c = new AbortController();
    const q = new URLSearchParams({ page: String(page), size: "10" }); if (term) q.set("keyword", term);
    void Promise.resolve().then(() => { if (!c.signal.aborted) { setLoading(true); setError(""); } });
    getEmployeePage(q.toString(), c.signal).then((d) => { if (!c.signal.aborted) setData(d); }).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được nhân viên."); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [page, term, nonce]);
  function onType(v: string) { setKeyword(v); if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { setPage(0); setTerm(v.trim()); }, 350); }
  function reset() { if (timer.current) window.clearTimeout(timer.current); setKeyword(""); setTerm(""); setPage(0); }
  const rows = data?.content ?? [];
  return <AdminShellB active="employees" title="Nhân sự">
    <PageHeader title="Nhân sự" hint="CCCD được che ở danh sách; chỉ hiện đầy đủ ở trang chi tiết và biểu mẫu. Xóa hồ sơ là chuyển vào thùng rác và khóa tài khoản đăng nhập liên kết (nếu có); hồ sơ đã liên kết tài khoản chỉ Quản trị viên xóa được."
      actions={can("EMPLOYEE_CREATE") ? <button className="primary" type="button" onClick={() => setCreating(true)}>Tạo hồ sơ nhân sự</button> : null} />
    <AdminModal open={creating} title="Tạo hồ sơ nhân sự" size="md" busy={busy} onClose={() => { if (!busy) setCreating(false); }}
      footer={<><button className="secondary" type="button" disabled={busy} onClick={() => setCreating(false)}>Hủy</button><button className="primary" type="submit" form="employee-create-form" disabled={busy}>{busy ? "Đang lưu…" : "Tạo hồ sơ"}</button></>}>
      <EmployeeForm mode="create" formId="employee-create-form" onBusyChange={setBusy} onCancel={() => setCreating(false)}
        onSaved={(e) => { setCreating(false); toast.success(`Đã tạo hồ sơ ${[e.firstName, e.lastName].filter(Boolean).join(" ")}.`); setPage(0); setNonce((n) => n + 1); }} />
    </AdminModal>
    <div className="orders-filters l3-filters" role="search">
      <div className="catalog-field live-search-field"><label htmlFor="emp-search">Tìm họ tên / SĐT / CCCD</label><div className="live-search-control"><input id="emp-search" type="search" className="catalog-input" maxLength={100} placeholder="Tìm họ tên, SĐT hoặc CCCD" value={keyword} onChange={(e) => onType(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") reset(); }} />{keyword ? <button className="live-search-clear" type="button" onClick={reset} aria-label="Xóa từ khóa">Xóa</button> : null}</div></div>
    </div>
    {loading && !data ? <TableSkeleton rows={8} columns={6} /> : null}
    {error ? <div className="order-empty" role="alert"><strong>Không tải được hồ sơ nhân sự</strong><p>{error}</p><button className="secondary" type="button" onClick={() => setNonce((n) => n + 1)}>Thử lại</button></div> : null}
    {!loading && !error && data?.content.length === 0 ? <div className="order-empty"><strong>Không có hồ sơ nhân sự khớp</strong><p>Thử từ khóa khác.</p></div> : null}
    {rows.length > 0 ? <div className="table-scroll sticky-head review-table-scroll table-cards" tabIndex={0} aria-label="Danh sách nhân sự" aria-busy={loading}><table className="review-orders-table l3-table"><caption className="sr-only">Hồ sơ nhân sự</caption><thead><tr><th>Họ tên</th><th>SĐT</th><th>CCCD</th><th>Tài khoản</th><th>Vai trò</th></tr></thead><tbody>{rows.map((e) => {
      const name = [e.firstName, e.lastName].filter(Boolean).join(" ") || `Hồ sơ ${e.id}`;
      return <RowLink key={e.id} href={`/quan-tri/nhan-vien/${e.id}`}>
        <td data-label="Họ tên" className="cell-title"><Link className="pl-name" href={`/quan-tri/nhan-vien/${e.id}`}>{name}</Link></td>
        <td data-label="SĐT" className="tabnum">{e.phoneNumber}</td>
        <td data-label="CCCD" className="people-mask tabnum">{maskCccd(e.cccd)}</td>
        <td data-label="Tài khoản">{e.username ?? <span className="empty-value">Chưa liên kết</span>}</td>
        <td data-label="Vai trò">{e.username ? <StatusBadge status="ROLE" tone={e.role === "ADMIN" ? "violet" : "blue"} label={roleLabel(e.role)} /> : <span className="empty-value">Chưa có</span>}</td>
      </RowLink>;
    })}</tbody></table></div> : null}
    {data && data.content.length > 0 ? <Pager page={page} totalPages={data.totalPages} total={data.totalElements} unit="hồ sơ" busy={loading} onPage={setPage} /> : null}
  </AdminShellB>;
}
