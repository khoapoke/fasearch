"use client";

import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { beFetch, beWrite, unwrap, type Page } from "@/lib/mgmt-client";

type Customer = {
  id: number;
  hoTen: string;
  ho: string | null;
  ten: string | null;
  sdt: string;
  gioiTinh: string | null;
  ngaySinh: string | null;
  diaChi: string | null;
  email: string | null;
  diemTichLuy: number;
  maHang: number | null;
  tenHang: string | null;
  maTk: number | null;
};

export default function CustomersPage() {
  const [ten, setTen] = useState("");
  const [sdt, setSdt] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page<Customer> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    let live = true;
    const query = new URLSearchParams();
    if (ten) query.set("ten", ten);
    if (sdt) query.set("sdt", sdt);
    query.set("page", String(page));
    query.set("size", "20");
    beFetch(`v1/users?${query.toString()}`)
      .then((response) => unwrap<Page<Customer>>(response))
      .then((result) => {
        if (live) {
          setData(result);
          setNotice(null);
        }
      })
      .catch((e: unknown) => {
        if (live) setNotice(e instanceof Error ? e.message : "Tải thất bại.");
      });
    return () => {
      live = false;
    };
  }, [ten, sdt, page, reloadKey]);

  return (
    <MerchantShell
      active="customers"
      topActions={
        <button className="mpTopBtn primary" type="button" onClick={() => setShowCreate((v) => !v)}>
          + {showCreate ? "Đóng form tạo" : "Tạo hồ sơ"}
        </button>
      }
    >
      <div className="mpCard">
        <h2>Quản lý khách hàng</h2>
        <p className="mpMuted">Tra cứu, tạo và sửa hồ sơ khách hàng. Điểm/hạng chỉ đọc.</p>
      <form
        style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          reload();
        }}
      >
        <div className="mpSearch" style={{ maxWidth: 240 }}>
          <input value={ten} onChange={(e) => setTen(e.target.value)} maxLength={100} placeholder="Tên…" aria-label="Tên" />
        </div>
        <div className="mpSearch" style={{ maxWidth: 200 }}>
          <input value={sdt} onChange={(e) => setSdt(e.target.value)} maxLength={15} placeholder="SĐT…" aria-label="SĐT" />
        </div>
        <button className="mpTopBtn primary" type="submit">
          Lọc
        </button>
      </form>
      {notice && (
        <p className="mpMuted" role="alert" style={{ color: "#ba1a1a" }}>
          Lỗi: {notice}
        </p>
      )}
      </div>
      {showCreate && <div className="mpCard"><CreateForm onDone={() => { setShowCreate(false); reload(); }} /></div>}
      {editing && (
        <div className="mpCard"><EditForm
          customer={editing}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); reload(); }}
        /></div>
      )}
      <div className="mpCard">
      {!data && <p className="mpMuted" role="status">Đang tải…</p>}
      {data && data.data.length === 0 && <p className="mpMuted">Không có khách hàng nào.</p>}
      {data && data.data.length > 0 && (
        <>
          <div className="mpTableWrap">
            <table className="mpTable">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Họ tên / SĐT</th>
                  <th>Hạng / Điểm (chỉ đọc)</th>
                  <th>Email (tài khoản)</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>
                      <b>{row.hoTen}</b>
                      <br />
                      {row.sdt}
                    </td>
                    <td>
                      {row.tenHang ?? "—"} / {row.diemTichLuy} điểm
                    </td>
                    <td>{row.email ?? "—"}</td>
                    <td>
                      <div className="mpRowBtns">
                        <button className="mpTopBtn" style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={() => setEditing(row)}>
                          Xem / Sửa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mpMuted" style={{ marginTop: 10 }}>
              Trang {data.page + 1}/{Math.max(data.totalPages, 1)} — {data.totalElements} hồ sơ
            {page > 0 && (
              <button className="mpTopBtn" style={{ marginLeft: 8 }} onClick={() => setPage(page - 1)}>
                Trước
              </button>
            )}
            {page + 1 < data.totalPages && (
              <button className="mpTopBtn" style={{ marginLeft: 8 }} onClick={() => setPage(page + 1)}>
                Sau
              </button>
            )}
          </p>
        </>
      )}
      </div>
    </MerchantShell>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setSaving(true);
    setError(null);
    try {
      const body = {
        ho: emptyNull(form.get("ho")),
        ten: String(form.get("ten")),
        sdt: String(form.get("sdt")),
        gioiTinh: emptyNull(form.get("gioiTinh")),
        diaChi: emptyNull(form.get("diaChi")),
        email: emptyNull(form.get("email")),
        maTk: Number(form.get("maTk")),
      };
      const response = await beWrite("v1/users", "POST", body);
      await unwrap(response);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo thất bại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Tạo hồ sơ khách hàng">
      <h2>Tạo hồ sơ nối vào tài khoản đã có</h2>
      <p className="mpMuted">
        Hồ sơ gắn vào tài khoản CUSTOMER chưa có hồ sơ (lấy mã tài khoản ở trang Tài khoản). SĐT
        trùng → 409.
      </p>
      <form
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        <label>
          Mã tài khoản (maTk)*
          <input name="maTk" required inputMode="numeric" />
        </label>
        <label>
          Họ
          <input name="ho" maxLength={50} />
        </label>
        <label>
          Tên*
          <input name="ten" required maxLength={50} />
        </label>
        <label>
          SĐT*
          <input name="sdt" required maxLength={15} />
        </label>
        <label>
          Giới tính
          <input name="gioiTinh" maxLength={10} />
        </label>
        <label>
          Địa chỉ
          <input name="diaChi" />
        </label>
        <label>
          Email (cập nhật cùng tài khoản)
          <input name="email" type="email" maxLength={100} />
        </label>
        <div style={{ gridColumn: "1/-1" }}>
          <button className="mpTopBtn primary" type="submit" disabled={saving}>
            {saving ? "Đang tạo…" : "Tạo hồ sơ"}
          </button>
          {error && (
            <p role="alert" style={{ color: "#ba1a1a" }}>
              Lỗi: {error}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

function EditForm({
  customer,
  onClose,
  onDone,
}: {
  customer: Customer;
  onClose: () => void;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setSaving(true);
    setError(null);
    try {
      const body = {
        ho: emptyNull(form.get("ho")),
        ten: String(form.get("ten")),
        gioiTinh: emptyNull(form.get("gioiTinh")),
        diaChi: emptyNull(form.get("diaChi")),
        email: emptyNull(form.get("email")),
      };
      const response = await beWrite(`v1/users/${customer.id}`, "PATCH", body);
      await unwrap(response);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label={`Sửa khách hàng ${customer.id}`}>
      <h2>Hồ sơ #{customer.id} — {customer.hoTen}</h2>
      <p className="mpMuted">
        SĐT {customer.sdt} (không đổi) · Hạng {customer.tenHang ?? "—"} · {customer.diemTichLuy}{" "}
        điểm (chỉ đọc).
      </p>
      <form
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        <label>
          Họ
          <input name="ho" defaultValue={customer.ho ?? ""} maxLength={50} />
        </label>
        <label>
          Tên*
          <input name="ten" defaultValue={customer.ten ?? ""} required maxLength={50} />
        </label>
        <label>
          Giới tính
          <input name="gioiTinh" defaultValue={customer.gioiTinh ?? ""} maxLength={10} />
        </label>
        <label>
          Địa chỉ
          <input name="diaChi" defaultValue={customer.diaChi ?? ""} />
        </label>
        <label>
          Email (nguyên tử cùng tài khoản)
          <input name="email" type="email" defaultValue={customer.email ?? ""} maxLength={100} />
        </label>
        <div style={{ gridColumn: "1/-1" }}>
          <div className="mpRowBtns">
            <button className="mpTopBtn primary" type="submit" disabled={saving}>
              {saving ? "Đang lưu…" : "Lưu"}
            </button>
            <button className="mpTopBtn" type="button" onClick={onClose}>
              Đóng
            </button>
          </div>
          {error && (
            <p role="alert" style={{ color: "#ba1a1a" }}>
              Lỗi: {error}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

function emptyNull(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}
