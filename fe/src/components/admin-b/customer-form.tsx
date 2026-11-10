"use client";
import { useRouter } from "next/navigation";
import { DateInput } from "@/components/ui/date-input";
import { useRef, useState } from "react";
import { createCustomer, updateCustomer, CustomerAdminError, type Customer } from "@/lib/admin-customer-client";
type Values = { firstName: string; lastName: string; phoneNumber: string; gender: string; dob: string; address: string };
const EMPTY: Values = { firstName: "", lastName: "", phoneNumber: "", gender: "", dob: "", address: "" };
export function CustomerForm({ mode, customer, formId, onSaved, onCancel, onBusyChange }: { mode: "create" | "edit"; customer?: Customer; formId?: string; onSaved?: (c: Customer) => void; onCancel?: () => void; onBusyChange?: (busy: boolean) => void }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(customer ? { firstName: customer.firstName ?? "", lastName: customer.lastName, phoneNumber: customer.phoneNumber, gender: customer.gender ?? "", dob: customer.dob ?? "", address: customer.address ?? "" } : EMPTY);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const busyRef = useRef(false); const [focus, setFocus] = useState("");
  function set(key: keyof Values, value: string) { setValues((v) => ({ ...v, [key]: value })); if (focus === key) setFocus(""); }
  function invalid(field: keyof Values, message: string) {
    setError(message); setFocus(field);
    const ids: Partial<Record<keyof Values, string>> = { lastName: "cust-last", phoneNumber: "cust-phone", dob: "cust-dob" };
    requestAnimationFrame(() => document.getElementById(ids[field] ?? "")?.focus());
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busyRef.current) return;
    if (!values.lastName.trim()) { invalid("lastName", "Nhập tên khách hàng."); return; }
    if (!/^(0|\+84)[0-9]{9}$/.test(values.phoneNumber.trim())) { invalid("phoneNumber", "Số điện thoại không đúng định dạng Việt Nam."); return; }
    if (values.dob && !/^\d{4}-\d{2}-\d{2}$/.test(values.dob)) { invalid("dob", "Ngày sinh chưa hợp lệ."); return; }
    busyRef.current = true; setBusy(true); onBusyChange?.(true); setError("");
    try {
      const body = { firstName: values.firstName.trim(), lastName: values.lastName.trim(), phoneNumber: values.phoneNumber.trim(), ...(values.gender ? { gender: values.gender } : {}), ...(values.dob ? { dob: values.dob } : {}), address: values.address.trim() };
      const saved = mode === "create" ? await createCustomer(body) : await updateCustomer(String(customer?.id), body);
      if (onSaved) onSaved(saved); else { router.push(`/quan-tri/khach-hang/${saved.id}`); return; } // navigating away: stay busy
    } catch (failure) { setError(failure instanceof CustomerAdminError ? failure.message : "Không lưu được hồ sơ khách hàng."); }
    busyRef.current = false; setBusy(false); onBusyChange?.(false);
  }
  return <form id={formId} className="catalog-form form-grid" onSubmit={submit} aria-busy={busy} noValidate>
    <div className="catalog-field"><label htmlFor="cust-first">Họ</label><input id="cust-first" className="catalog-input" maxLength={50} value={values.firstName} onChange={(e) => set("firstName", e.target.value)} aria-invalid={focus === "firstName" || undefined} /></div>
    <div className="catalog-field"><label htmlFor="cust-last">Tên *</label><input id="cust-last" className="catalog-input" maxLength={50} value={values.lastName} onChange={(e) => set("lastName", e.target.value)} aria-invalid={focus === "lastName" || undefined} /></div>
    <div className="catalog-field"><label htmlFor="cust-phone">Số điện thoại *</label><input id="cust-phone" className="catalog-input" inputMode="tel" maxLength={12} value={values.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} aria-invalid={focus === "phoneNumber" || undefined} /></div>
    <div className="catalog-field"><label htmlFor="cust-gender">Giới tính</label><select id="cust-gender" className="catalog-input" value={values.gender} onChange={(e) => set("gender", e.target.value)}><option value="">Không chỉ định</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></div>
    <div className="catalog-field"><label htmlFor="cust-dob">Ngày sinh</label><DateInput id="cust-dob" className="catalog-input" value={values.dob} onChange={(v) => set("dob", v)} aria-invalid={focus === "dob" || undefined} /></div>
    <div className="catalog-field full"><label htmlFor="cust-address">Địa chỉ hiện tại</label><textarea id="cust-address" className="catalog-input customer-address-input" rows={3} maxLength={255} value={values.address} onChange={(e) => set("address", e.target.value)} /></div>
    {error ? <p className="catalog-error" role="alert">{error}</p> : null}
    {formId ? null : <div className="catalog-actions"><button className="primary" type="submit" disabled={busy}>{busy ? "Đang lưu…" : mode === "create" ? "Tạo khách hàng" : "Lưu thay đổi"}</button><button className="secondary" type="button" disabled={busy} onClick={() => onCancel ? onCancel() : router.push(customer ? `/quan-tri/khach-hang/${customer.id}` : "/quan-tri/khach-hang")}>Hủy</button></div>}
  </form>;
}
