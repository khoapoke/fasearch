"use client";

import { useEffect, useState } from "react";
import { MgmtShell } from "@/components/mgmt/mgmt-shell";
import account from "@/components/account/account.module.css";
import mgmt from "@/components/mgmt/mgmt.module.css";
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
    <MgmtShell
      title="Quản lý khách hàng"
      lede="Tra cứu, tạo và sửa hồ sơ khách hàng (FR22, FR36–37). Điểm/hạng chỉ đọc — không có công thức tích điểm tự bịa."
      need={["ADMIN", "STAFF"]}
    >
      <form
        className={mgmt.toolbar}
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          reload();
        }}
      >
        <label>
          Tên
          <input value={ten} onChange={(e) => setTen(e.target.value)} maxLength={100} />
        </label>
        <label>
          SĐT
          <input value={sdt} onChange={(e) => setSdt(e.target.value)} maxLength={15} />
        </label>
        <button className={account.primary} type="submit">
          Lọc
        </button>
        <button type="button" className={account.secondary} onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Đóng form tạo" : "Tạo hồ sơ"}
        </button>
      </form>
      {notice && (
        <p className={account.muted} role="alert">
          Lỗi: {notice}
        </p>
      )}
      {showCreate && <CreateForm onDone={() => { setShowCreate(false); reload(); }} />}
      {editing && (
        <EditForm
          customer={editing}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); reload(); }}
        />
      )}
      {!data && <p className={account.muted}>Đang tải…</p>}
      {data && data.data.length === 0 && <p className={account.muted}>Không có khách hàng nào.</p>}
      {data && data.data.length > 0 && (
        <>
          <div className={mgmt.tableWrap}>
            <table className={mgmt.table}>
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
                      <div className={mgmt.rowActions}>
                        <button className={mgmt.linkButton} onClick={() => setEditing(row)}>
                          Xem / Sửa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={mgmt.pager}>
            <span>
              Trang {data.page + 1}/{Math.max(data.totalPages, 1)} — {data.totalElements} hồ sơ
            </span>
            {page > 0 && (
              <button className={mgmt.linkButton} onClick={() => setPage(page - 1)}>
                Trước
              </button>
            )}
            {page + 1 < data.totalPages && (
              <button className={mgmt.linkButton} onClick={() => setPage(page + 1)}>
                Sau
              </button>
            )}
          </div>
        </>
      )}
    </MgmtShell>
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
    <section className={account.card} aria-label="Tạo hồ sơ khách hàng">
      <p className={account.greeting}>Tạo hồ sơ nối vào tài khoản đã có</p>
      <p className={account.muted}>
        Hồ sơ gắn vào tài khoản CUSTOMER chưa có hồ sơ (lấy mã tài khoản ở trang Tài khoản). SĐT
        trùng → 409.
      </p>
      <form
        className={mgmt.formGrid}
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
        <div className={mgmt.fullRow}>
          <button className={account.primary} type="submit" disabled={saving}>
            {saving ? "Đang tạo…" : "Tạo hồ sơ"}
          </button>
          {error && (
            <p className={account.muted} role="alert">
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
    <section className={account.card} aria-label={`Sửa khách hàng ${customer.id}`}>
      <p className={account.greeting}>
        Hồ sơ #{customer.id} — {customer.hoTen}
      </p>
      <p className={account.muted}>
        SĐT {customer.sdt} (không đổi) · Hạng {customer.tenHang ?? "—"} · {customer.diemTichLuy}{" "}
        điểm (chỉ đọc) · Tiền chi tiêu: chưa có định nghĩa tổng hợp nên không lọc được.
      </p>
      <form
        className={mgmt.formGrid}
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
        <div className={mgmt.fullRow}>
          <div className={mgmt.rowActions}>
            <button className={account.primary} type="submit" disabled={saving}>
              {saving ? "Đang lưu…" : "Lưu"}
            </button>
            <button className={account.secondary} type="button" onClick={onClose}>
              Đóng
            </button>
          </div>
          {error && (
            <p className={account.muted} role="alert">
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
