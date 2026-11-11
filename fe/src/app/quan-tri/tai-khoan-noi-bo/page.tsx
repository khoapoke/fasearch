"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { AccountForm } from "@/components/admin-b/account-form";
import { DeleteReasonPanel } from "@/components/admin-b/delete-reason-panel";
import { AdminModal } from "@/components/admin-b/modal";
import { PageHeader } from "@/components/admin-b/page-header";
import { Pager } from "@/components/admin-b/pagination";
import { RolePermissionsEditor } from "@/components/admin-b/role-permissions-editor";
import { TableSkeleton } from "@/components/admin-b/skeleton";
import { StatusBadge } from "@/components/admin-b/status-badge";
import { useToast } from "@/components/admin-b/toast";
import { useAdminIdentity } from "@/components/admin-b/admin-frame";
import { deleteAccount, getAccountPage, roleLabel, statusLabel, type InternalAccount } from "@/lib/admin-people-client";
import { formatDateTime } from "@/lib/admin-format";
const STATUSES = ["", "ACTIVE", "INACTIVE", "LOCKED"];
const PAGE_SIZE = 10;
const FETCH_SIZE = 50;
const MAX_FETCH_PAGES = 20; // per role, so "Tất cả" is bounded at 1.000 tài khoản mỗi vai trò
const STATUS_TONE = { ACTIVE: "green", INACTIVE: "gray", LOCKED: "red" } as const;
export default function InternalAccountsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"accounts" | "roles">("accounts");
  const me = useAdminIdentity(); const allowed: boolean | null = me ? me.role === "ADMIN" : null;
  const [rows, setRows] = useState<InternalAccount[]>([]); const [page, setPage] = useState(0); const [total, setTotal] = useState(0); const [serverPages, setServerPages] = useState(1); const [truncated, setTruncated] = useState(false);
  const [keyword, setKeyword] = useState(""); const [term, setTerm] = useState(""); const [role, setRole] = useState(""); const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [nonce, setNonce] = useState(0);
  const [formOpen, setFormOpen] = useState(false); const [editing, setEditing] = useState<InternalAccount | null>(null); const [formBusy, setFormBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InternalAccount | null>(null); const [deleteIssue, setDeleteIssue] = useState(""); const [deleteBusy, setDeleteBusy] = useState(false);
  const timer = useRef<number | null>(null);
  const fetchPage = role ? page : 0; // "Tất cả" pages on the client and must not refetch on a page click
  useEffect(() => {
    if (allowed !== true) return;
    const c = new AbortController();
    // "Tất cả" = Quản lý + Quản trị viên (the BE would otherwise also return customer accounts).
    void Promise.resolve().then(() => { if (!c.signal.aborted) { setLoading(true); setError(""); } });
    const base = (r: string, p: number, size: number) => { const q = new URLSearchParams({ page: String(p), size: String(size), role: r }); if (term) q.set("keyword", term); if (status) q.set("status", status); return q.toString(); };
    const run = role
      // One role: real server paging.
      ? getAccountPage(base(role, fetchPage, PAGE_SIZE), c.signal).then((res) => ({ list: res.content, total: res.totalElements, pages: Math.max(1, res.totalPages), cut: false }))
      // Both roles: load every page of each role (bounded), then page on the client with real totals.
      : Promise.all(["STAFF", "ADMIN"].map(async (r) => {
        const list: InternalAccount[] = [];
        let totalElements = 0;
        for (let p = 0; p < MAX_FETCH_PAGES; p++) {
          const res = await getAccountPage(base(r, p, FETCH_SIZE), c.signal);
          totalElements = res.totalElements;
          list.push(...res.content);
          if (res.last || res.content.length === 0 || p + 1 >= res.totalPages) return { list, totalElements, cut: false };
        }
        return { list, totalElements, cut: list.length < totalElements };
      })).then((parts) => ({ list: parts.flatMap((x) => x.list).sort((a, b) => b.id - a.id), total: parts.reduce((n, x) => n + x.totalElements, 0), pages: 1, cut: parts.some((x) => x.cut) }));
    run
      .then((res) => { if (!c.signal.aborted) { setRows(res.list); setTotal(res.total); setServerPages(res.pages); setTruncated(res.cut); } })
      .catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được tài khoản nội bộ."); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [allowed, role, status, term, nonce, fetchPage]);
  function onType(v: string) { setKeyword(v); if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { setPage(0); setTerm(v.trim()); }, 350); }
  const filtered = Boolean(keyword || role || status);
  function reset() { if (timer.current) window.clearTimeout(timer.current); setKeyword(""); setTerm(""); setRole(""); setStatus(""); setPage(0); }
  function saved(a: InternalAccount) { setFormOpen(false); setEditing(null); toast.success(`Đã lưu tài khoản ${a.username}.`); setNonce((n) => n + 1); }
  async function confirmDelete(reason: string) {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true); setDeleteIssue("");
    try { const username = deleteTarget.username; await deleteAccount(deleteTarget.id, reason); setDeleteTarget(null); toast.success(`Đã chuyển tài khoản ${username} vào thùng rác.`); setNonce((n) => n + 1); }
    catch (e) { setDeleteIssue(e instanceof Error && e.message ? e.message : "Chưa xóa được tài khoản. Thử lại."); }
    finally { setDeleteBusy(false); }
  }
  const totalPages = role ? serverPages : Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages - 1);
  const pageRows = useMemo(() => role ? rows : rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE), [rows, current, role]);
  if (allowed === false) return <AdminShellB active="internalAccounts" title="Tài khoản nội bộ"><div className="order-empty" role="alert"><strong>Không có quyền truy cập</strong><p>Chỉ Quản trị viên xem được tài khoản nội bộ.</p></div></AdminShellB>;
  return <AdminShellB active="internalAccounts" title="Tài khoản nội bộ">
    <PageHeader title="Tài khoản nội bộ"
      hint="Tài khoản của Quản lý và Quản trị viên; mật khẩu không xem lại được. Xóa tài khoản là chuyển vào thùng rác: chặn đăng nhập ngay và khôi phục ở trạng thái Ngừng hoạt động. Thay đổi vai trò hoặc trạng thái có hiệu lực từ yêu cầu kế tiếp; phiên đang mở bị từ chối nếu tài khoản không còn Hoạt động. Đổi mật khẩu không thu hồi các phiên đang đăng nhập."
      actions={<button className="primary" type="button" style={{ visibility: tab === "accounts" ? "visible" : "hidden" }} tabIndex={tab === "accounts" ? 0 : -1} aria-hidden={tab !== "accounts"} onClick={() => { setEditing(null); setFormOpen(true); }}>Tạo tài khoản</button>} />
    <div className="l3-tabs" role="tablist" aria-label="Nội dung">
      <button type="button" role="tab" id="ia-tab-accounts" aria-selected={tab === "accounts"} aria-controls="ia-panel" onClick={() => setTab("accounts")}>Tài khoản</button>
      <button type="button" role="tab" id="ia-tab-roles" aria-selected={tab === "roles"} aria-controls="ia-panel" onClick={() => setTab("roles")}>Vai trò &amp; quyền</button>
    </div>
    <div id="ia-panel" role="tabpanel" aria-labelledby={`ia-tab-${tab}`}>
    {tab === "roles" ? <RolePermissionsEditor /> : <>
      <div className="orders-filters l3-filters" role="search">
        <div className="catalog-field live-search-field"><label htmlFor="ia-search">Tìm tên đăng nhập / email</label><div className="live-search-control"><input id="ia-search" type="search" className="catalog-input" maxLength={100} placeholder="Tìm tên đăng nhập hoặc email" value={keyword} onChange={(e) => onType(e.target.value)} />{keyword ? <button className="live-search-clear" type="button" onClick={() => { if (timer.current) window.clearTimeout(timer.current); setKeyword(""); setTerm(""); setPage(0); }} aria-label="Xóa từ khóa">Xóa</button> : null}</div></div>
        <div className="catalog-field l3-select"><label htmlFor="ia-role">Vai trò</label><select id="ia-role" className="catalog-input" value={role} onChange={(e) => { setRole(e.target.value); setPage(0); }}><option value="">Tất cả vai trò</option><option value="STAFF">Quản lý</option><option value="ADMIN">Quản trị viên</option></select></div>
        <div className="catalog-field l3-select"><label htmlFor="ia-status">Trạng thái</label><select id="ia-status" className="catalog-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>{STATUSES.map((v) => <option key={v || "all"} value={v}>{v ? statusLabel(v) : "Tất cả trạng thái"}</option>)}</select></div>
        {filtered ? <button className="secondary" type="button" onClick={reset}>Đặt lại</button> : null}
      </div>
      {loading && rows.length === 0 ? <TableSkeleton rows={6} columns={6} /> : null}
      {error ? <div className="order-empty" role="alert"><strong>Không tải được tài khoản</strong><p>{error}</p><button className="secondary" type="button" onClick={() => setNonce((n) => n + 1)}>Thử lại</button></div> : null}
      {!loading && !error && rows.length === 0 ? <div className="order-empty"><strong>Không có tài khoản khớp</strong><p>Đổi vai trò, trạng thái hoặc từ khóa.</p></div> : null}
      {pageRows.length > 0 ? <div className="table-scroll sticky-head review-table-scroll table-cards" tabIndex={0} aria-label="Tài khoản nội bộ" aria-busy={loading}><table className="review-orders-table l3-table"><caption className="sr-only">Tài khoản nội bộ</caption><thead><tr><th>Tên đăng nhập</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th><th className="num">Thao tác</th></tr></thead><tbody>{pageRows.map((a) => <tr key={a.id}>
        <td data-label="Tên đăng nhập" className="cell-title">{a.username}{me?.id === a.id ? <small>Tài khoản đang đăng nhập</small> : null}</td>
        <td data-label="Email"><span className="l3-clip" title={a.email}>{a.email}</span></td>
        <td data-label="Vai trò"><StatusBadge status="ROLE" tone={a.role === "ADMIN" ? "violet" : "blue"} label={roleLabel(a.role)} /></td>
        <td data-label="Trạng thái"><StatusBadge status={a.status} tone={STATUS_TONE[a.status as keyof typeof STATUS_TONE]} label={statusLabel(a.status)} /></td>
        <td data-label="Ngày tạo" className="cell-date">{formatDateTime(a.createdAt)}</td>
        <td data-label="Thao tác" className="num"><div className="row-actions end"><button className="secondary btn-sm" type="button" onClick={() => { setEditing(a); setFormOpen(true); }}>Sửa</button>{me?.id === a.id ? null : <button className="danger btn-sm" type="button" disabled={deleteBusy} onClick={() => { setDeleteIssue(""); setDeleteTarget(a); }}>Xóa</button>}</div></td>
      </tr>)}</tbody></table></div> : null}
      {rows.length > 0 ? <Pager page={current} totalPages={totalPages} total={total} unit="tài khoản" onPage={setPage} /> : null}
      {truncated ? <p className="meta" role="status">Chỉ hiển thị {rows.length} trong {total} tài khoản. Dùng tìm kiếm hoặc lọc để thu hẹp.</p> : null}
    </>}
    </div>
    <AdminModal open={formOpen} title={editing ? `Sửa tài khoản ${editing.username}` : "Tạo tài khoản nội bộ"} size="md" busy={formBusy} onClose={() => { if (!formBusy) { setFormOpen(false); } }}
      footer={<><button className="secondary" type="button" disabled={formBusy} onClick={() => setFormOpen(false)}>Hủy</button><button className="primary" type="submit" form="account-form" disabled={formBusy}>{formBusy ? "Đang lưu…" : editing ? "Lưu tài khoản" : "Tạo tài khoản"}</button></>}>
      <AccountForm key={editing?.id ?? "new"} mode={editing ? "edit" : "create"} account={editing ?? undefined} ownId={me?.id ?? null} formId="account-form" onBusyChange={setFormBusy} onSaved={saved} onCancel={() => setFormOpen(false)} />
    </AdminModal>
    <DeleteReasonPanel
      open={deleteTarget !== null}
      title="Xóa tài khoản đăng nhập này?"
      target={deleteTarget ? `${deleteTarget.username} · ${roleLabel(deleteTarget.role)}` : ""}
      consequence="Tài khoản bị chặn đăng nhập ngay (mọi token đã cấp mất hiệu lực) và chuyển vào thùng rác; dữ liệu không bị xóa vĩnh viễn. Tự xóa tài khoản đang đăng nhập, xóa Quản trị viên đang hoạt động cuối cùng và tài khoản còn hồ sơ liên kết sẽ bị từ chối. Khôi phục đưa tài khoản về Ngừng hoạt động, phải bật Hoạt động mới đăng nhập lại được."
      busy={deleteBusy}
      refusal={deleteIssue}
      onClose={() => { if (!deleteBusy) { setDeleteTarget(null); setDeleteIssue(""); } }}
      onConfirm={(reason) => void confirmDelete(reason)}
    />
  </AdminShellB>;
}
