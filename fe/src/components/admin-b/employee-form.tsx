"use client";
import { useEffect, useState } from "react";
import { DateInput } from "@/components/ui/date-input";
import { useAdminRole } from "./use-admin-role";
import { createEmployee, getAccountPage, getEmployeePage, updateEmployee, PeopleError, roleLabel, type Employee, type InternalAccount } from "@/lib/admin-people-client";
type Option = InternalAccount & { linkedBy: string | null };
export function EmployeeForm({ mode, employee, onSaved, onCancel, formId, onBusyChange, leaving }: { leaving?: boolean; mode: "create" | "edit"; employee?: Employee; onSaved: (e: Employee) => void; onCancel: () => void; formId?: string; onBusyChange?: (busy: boolean) => void }) {
  const role = useAdminRole(); const isAdmin = role === "ADMIN";
  const [firstName, setFirstName] = useState(employee?.firstName ?? ""); const [lastName, setLastName] = useState(employee?.lastName ?? ""); const [phoneNumber, setPhoneNumber] = useState(employee?.phoneNumber ?? ""); const [cccd, setCccd] = useState(employee?.cccd ?? ""); const [gender, setGender] = useState(employee?.gender ?? ""); const [dob, setDob] = useState(employee?.dob ?? ""); const [address, setAddress] = useState(employee?.address ?? ""); const [accountId, setAccountId] = useState(employee?.accountId ? String(employee.accountId) : ""); const [accounts, setAccounts] = useState<Option[]>([]); const [accountsError, setAccountsError] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!isAdmin) return; const c = new AbortController(); Promise.all([getAccountPage("page=0&size=50&role=STAFF", c.signal), getAccountPage("page=0&size=50&role=ADMIN", c.signal), getEmployeePage("page=0&size=50", c.signal)]).then(([staff, admins, employees]) => { const linked = new Map<number, string>(); for (const e of employees.content) if (e.accountId && e.id !== employee?.id) linked.set(e.accountId, [e.firstName, e.lastName].filter(Boolean).join(" ") || `hồ sơ #${e.id}`); const options = [...staff.content, ...admins.content].map((a) => ({ ...a, linkedBy: linked.get(a.id) ?? null })); if (employee?.accountId && !options.some((a) => a.id === employee.accountId)) options.unshift({ id: employee.accountId, username: employee.username ?? `#${employee.accountId}`, email: "", role: employee.role ?? "", status: "ACTIVE", createdAt: "", linkedBy: null }); setAccounts(options); }).catch((e) => { if (!c.signal.aborted) setAccountsError(e instanceof Error ? e.message : "Không tải được tài khoản nội bộ."); }); return () => c.abort(); }, [isAdmin, employee?.id, employee?.accountId, employee?.username, employee?.role]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setError("");
    if (!lastName.trim()) { setError("Nhập tên trong hồ sơ nhân sự."); return; }
    if (!/^(0|\+84)[0-9]{9}$/.test(phoneNumber.trim())) { setError("Số điện thoại không đúng định dạng Việt Nam."); return; }
    if (!/^[0-9]{12}$/.test(cccd.trim())) { setError("CCCD phải đúng 12 chữ số."); return; }
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) { setError("Ngày sinh chưa hợp lệ."); return; }
    setBusy(true); onBusyChange?.(true);
    try {
      const body: Record<string, unknown> = { firstName: firstName.trim(), lastName: lastName.trim(), phoneNumber: phoneNumber.trim(), cccd: cccd.trim(), address: address.trim() }; if (gender) body.gender = gender; if (dob) body.dob = dob; if (isAdmin && accountId) body.accountId = Number(accountId);
      const saved = mode === "create" ? await createEmployee(body) : await updateEmployee(String(employee!.id), body); onSaved(saved); if (leaving) return;
    } catch (failure) { setError(failure instanceof PeopleError && failure.status >= 400 && failure.status < 500 ? failure.message : failure instanceof PeopleError ? `${failure.message} Hồ sơ chưa được xác nhận đã lưu; tải lại trước khi thử tiếp.` : "Không lưu được hồ sơ nhân sự; tải lại trước khi thử tiếp."); }
    setBusy(false); onBusyChange?.(false);
  }
  const selected = accounts.find((a) => String(a.id) === accountId);
  return <form id={formId} className="catalog-form form-grid" onSubmit={submit} aria-busy={busy} noValidate>
    <div className="catalog-field"><label htmlFor="emp-first">Họ</label><input id="emp-first" className="catalog-input" maxLength={50} value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
    <div className="catalog-field"><label htmlFor="emp-last">Tên *</label><input id="emp-last" className="catalog-input" maxLength={50} value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
    <div className="catalog-field"><label htmlFor="emp-phone">Số điện thoại *</label><input id="emp-phone" className="catalog-input" inputMode="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} /></div>
    <div className="catalog-field"><label htmlFor="emp-cccd">CCCD *</label><input id="emp-cccd" className="catalog-input" inputMode="numeric" maxLength={12} value={cccd} onChange={(e) => setCccd(e.target.value)} /></div>
    <div className="catalog-field"><label htmlFor="emp-gender">Giới tính</label><select id="emp-gender" className="catalog-input" value={gender} onChange={(e) => setGender(e.target.value)}><option value="">Chưa chọn</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></div>
    <div className="catalog-field"><label htmlFor="emp-dob">Ngày sinh</label><DateInput id="emp-dob" className="catalog-input" value={dob} onChange={setDob} /></div>
    <div className="catalog-field full"><label htmlFor="emp-address">Địa chỉ</label><input id="emp-address" className="catalog-input" maxLength={255} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
    {isAdmin ? <>
    <div className="catalog-field full"><label htmlFor="emp-account">Tài khoản nội bộ liên kết (không bắt buộc)</label><select id="emp-account" className="catalog-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">{mode === "edit" && employee?.accountId ? "Giữ liên kết hiện tại" : "Không liên kết tài khoản"}</option>{accounts.map((a) => <option key={a.id} value={a.id} disabled={Boolean(a.linkedBy) && String(a.id) !== accountId}>#{a.id} {a.username} · {roleLabel(a.role)}{a.linkedBy ? ` · đã liên kết với ${a.linkedBy}` : ""}</option>)}</select><p className="meta">Tạo tài khoản ở mục Tài khoản nội bộ trước; đã liên kết thì không gỡ được.</p>{accountsError ? <p className="catalog-error" role="alert">{accountsError} Có thể nhập ID tài khoản thủ công nếu đã biết.</p> : null}{selected?.linkedBy ? <p className="catalog-error" role="alert">Tài khoản này đã liên kết với hồ sơ {selected.linkedBy}; không dùng lại được.</p> : null}</div>
    {accountsError ? <div className="catalog-field"><label htmlFor="emp-account-id">ID tài khoản (chỉ dùng khi danh sách không tải được)</label><input id="emp-account-id" className="catalog-input" inputMode="numeric" value={accountId} onChange={(e) => setAccountId(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Ví dụ: 12" /></div> : null}
    </> : <p className="meta">Liên kết tài khoản do Quản trị viên thực hiện.</p>}
    {error ? <p className="catalog-error" role="alert">{error}</p> : null}
    {formId ? null : <div className="catalog-actions"><button className="primary" type="submit" disabled={busy}>{busy ? "Đang lưu…" : mode === "create" ? "Tạo hồ sơ nhân sự" : "Lưu hồ sơ"}</button><button className="secondary" type="button" disabled={busy} onClick={onCancel}>Hủy</button></div>}
  </form>;
}
