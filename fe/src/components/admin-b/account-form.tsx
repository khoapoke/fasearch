"use client";
import { useState } from "react";
import { createAccount, updateAccount, PeopleError, roleLabel, type InternalAccount } from "@/lib/admin-people-client";
import "./h2.css";
export function AccountForm({ mode, account, ownId, onSaved, onCancel, formId, onBusyChange }: { mode: "create" | "edit"; account?: InternalAccount; ownId: number | null; onSaved: (a: InternalAccount) => void; onCancel: () => void; formId?: string; onBusyChange?: (busy: boolean) => void }) {
  const own = Boolean(account && ownId === account.id);
  const [username, setUsername] = useState(account?.username ?? ""); const [email, setEmail] = useState(account?.email ?? ""); const [password, setPassword] = useState(""); const [role, setRole] = useState(account?.role ?? "STAFF"); const [status, setStatus] = useState(account?.status ?? "ACTIVE"); const [confirm, setConfirm] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setError("");
    if (mode === "create" && (username.trim().length < 3 || username.trim().length > 50)) { setError("Tên đăng nhập phải từ 3 đến 50 ký tự."); return; }
    if (mode === "create" && password.length < 6) { setError("Mật khẩu tối thiểu 6 ký tự."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Email chưa đúng định dạng."); return; }
    if (password && password.length < 6) { setError("Mật khẩu mới tối thiểu 6 ký tự."); return; }
    const sensitive = (mode === "create" && role === "ADMIN") || (mode === "edit" && !own && (role !== account?.role || status !== account?.status || password.length > 0));
    if (sensitive && !confirm) { setError(mode === "create" ? "Xác nhận tạo tài khoản Quản trị viên trước khi lưu." : "Xác nhận thay đổi vai trò/trạng thái/mật khẩu trước khi lưu."); return; }
    setBusy(true); onBusyChange?.(true);
    try {
      const body: Record<string, unknown> = mode === "create" ? { username: username.trim(), password, email: email.trim(), role } : { email: email.trim(), ...(own ? {} : { role, status, ...(password ? { newPassword: password } : {}) }) };
      const saved = mode === "create" ? await createAccount(body) : await updateAccount(account!.id, body);
      onSaved(saved); setPassword("");
    } catch (failure) { setError(failure instanceof PeopleError ? failure.message : "Không lưu được tài khoản."); }
    finally { setBusy(false); onBusyChange?.(false); }
  }
  return <form id={formId} className="catalog-form form-grid" onSubmit={submit} aria-busy={busy} noValidate>
    {mode === "create" ? <div className="catalog-field"><label htmlFor="acct-username">Tên đăng nhập *</label><input id="acct-username" className="catalog-input" maxLength={50} value={username} onChange={(e) => setUsername(e.target.value)} /></div> : <p className="meta">Tài khoản: <strong>{account?.username}</strong> · {roleLabel(account?.role ?? null)}</p>}
    <div className="catalog-field"><label htmlFor="acct-email">Email *</label><input id="acct-email" type="email" className="catalog-input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
    {!(mode === "edit" && own) ? <div className="catalog-field"><label htmlFor="acct-password">{mode === "create" ? "Mật khẩu *" : "Mật khẩu mới (để trống nếu không đổi)"}</label><input id="acct-password" type="password" autoComplete="new-password" className="catalog-input" value={password} onChange={(e) => setPassword(e.target.value)} /></div> : null}
    {mode === "create" ? <div className="account-sensitive"><div className="catalog-field"><label htmlFor="acct-role">Vai trò</label><select id="acct-role" className="catalog-input" value={role} onChange={(e) => setRole(e.target.value)}><option value="STAFF">Quản lý</option><option value="ADMIN">Quản trị viên</option></select></div>{role === "ADMIN" ? <label className="account-confirm"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> Tôi xác nhận tạo tài khoản Quản trị viên {username || "(chưa nhập username)"} — quyền quản trị đầy đủ.</label> : null}</div> : own ? <p className="catalog-warning">Không thể đổi vai trò/trạng thái/mật khẩu của chính tài khoản đang đăng nhập. Chỉ có thể sửa email.</p> : <div className="account-sensitive"><div className="catalog-field"><label htmlFor="acct-role">Vai trò</label><select id="acct-role" className="catalog-input" value={role} onChange={(e) => setRole(e.target.value)}><option value="STAFF">Quản lý</option><option value="ADMIN">Quản trị viên</option></select><p className="meta h2-role-note">Tài khoản nội bộ không chuyển thành khách hàng được. Để thu hồi quyền: hạ xuống Quản lý, chuyển Ngừng hoạt động hoặc xóa.</p></div><div className="catalog-field"><label htmlFor="acct-status">Trạng thái</label><select id="acct-status" className="catalog-input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option><option value="LOCKED">Đã khóa</option></select></div><label className="account-confirm"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> Tôi xác nhận thay đổi vai trò/trạng thái/mật khẩu của tài khoản {account?.username}. Thay đổi có hiệu lực từ yêu cầu máy chủ kế tiếp; phiên đang mở không bị đăng xuất ngay.</label></div>}
    {error ? <p className="catalog-error" role="alert">{error}</p> : null}
    {formId ? null : <div className="catalog-actions"><button className="primary" type="submit" disabled={busy}>{busy ? "Đang lưu…" : mode === "create" ? "Tạo tài khoản" : "Lưu tài khoản"}</button><button className="secondary" type="button" disabled={busy} onClick={onCancel}>Hủy</button></div>}
    {formId ? null : <p className="meta">Mật khẩu không thể xem lại. Xóa tài khoản là chuyển vào thùng rác và chặn đăng nhập ngay (khôi phục về Ngừng hoạt động); không đổi quyền của chính tài khoản đang đăng nhập.</p>}
  </form>;
}
