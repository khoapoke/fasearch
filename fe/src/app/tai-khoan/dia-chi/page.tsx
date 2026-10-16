"use client";

import { useState } from "react";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { PREVIEW_ADDRESSES, type PreviewAddress } from "@/lib/preview-data";
import "@/components/storefront/preview.css";

export default function AddressesPage() {
  const [rows, setRows] = useState<PreviewAddress[]>(PREVIEW_ADDRESSES);
  const [form, setForm] = useState({ name: "", phone: "", address: "", kind: "Nhà riêng" });
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setMsg("Vui lòng nhập đủ họ tên, SĐT và địa chỉ.");
      return;
    }
    if (editing) {
      setRows((prev) => prev.map((x) => (x.id === editing ? { ...x, name: form.name.trim(), phone: form.phone.trim(), address: `${form.address.trim()} (${form.kind})` } : x)));
      setEditing(null);
      setMsg("Đã sửa địa chỉ trong sổ preview trên trình duyệt này.");
    } else {
      setRows((prev) => [...prev, { id: `local-${Date.now()}`, name: form.name.trim(), phone: form.phone.trim(), address: `${form.address.trim()} (${form.kind})`, isDefault: prev.length === 0 }]);
      setMsg("Đã thêm địa chỉ vào sổ preview trên trình duyệt này.");
    }
    setForm({ name: "", phone: "", address: "", kind: "Nhà riêng" });
  }

  return (
    <AccountCenterShell active="/tai-khoan/dia-chi" kicker="FASHION AI PROFILE HUB" title="Sổ Địa Chỉ Nhận Hàng">
      <p className="sfPreviewBar" role="note" style={{ borderRadius: 12, marginBottom: 14 }}>
        <span>Bản xem trước — địa chỉ lưu trên trình duyệt, máy chủ chưa có API sổ địa chỉ.</span>
      </p>
      {rows.map((a) => (
        <div className="pvAddr" key={a.id} aria-current={a.isDefault}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <b>{a.name}</b>
            {a.isDefault ? <span className="pMatch">Mặc định</span> : null}
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {!a.isDefault ? (
                <button type="button" className="hmCta hmCtaGhost" style={{ padding: "7px 12px", fontSize: 12 }} onClick={() => setRows((prev) => prev.map((x) => ({ ...x, isDefault: x.id === a.id })))}>Đặt mặc định</button>
              ) : null}
              <button type="button" className="hmCta hmCtaGhost" style={{ padding: "7px 12px", fontSize: 12 }} onClick={() => {
                setForm({ name: a.name, phone: a.phone, address: a.address.replace(/ \((Văn phòng|Nhà riêng|Khác)\)$/, ""), kind: (a.address.match(/\((Văn phòng|Nhà riêng|Khác)\)$/) || [])[1] || "Nhà riêng" });
                setEditing(a.id);
              }}>Sửa</button>
              <button type="button" className="hmCta hmCtaGhost" style={{ padding: "7px 12px", fontSize: 12 }} onClick={() => setRows((prev) => prev.filter((x) => x.id !== a.id))}>Xóa</button>
            </span>
          </div>
          <p>{a.phone} · {a.address}</p>
        </div>
      ))}
      <section className="sfSideCard" aria-label="Thêm địa chỉ mới">
        <b>{editing ? "Sửa địa chỉ" : "Thêm địa chỉ mới"}</b>
        <form onSubmit={add} style={{ marginTop: 10 }}>
          <div className="pvField"><label htmlFor="ad-name">Họ tên người nhận</label><input id="ad-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="pvField"><label htmlFor="ad-phone">Số điện thoại</label><input id="ad-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="pvField"><label htmlFor="ad-addr">Địa chỉ</label><input id="ad-addr" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Số nhà, đường, phường, quận, tỉnh/thành" /></div>
          <div className="pvField">
            <label htmlFor="ad-kind">Loại địa chỉ</label>
            <select id="ad-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
              <option>Văn phòng</option>
              <option>Nhà riêng</option>
              <option>Khác</option>
            </select>
          </div>
          <button className="hmCta hmCtaPrimary" style={{ padding: "10px 18px", fontSize: 13 }} type="submit">{editing ? "Lưu sửa đổi" : "Lưu địa chỉ"}</button>
          {msg ? <p className="mpMuted" role="status" style={{ marginTop: 8 }}>{msg}</p> : null}
        </form>
      </section>
    </AccountCenterShell>
  );
}
