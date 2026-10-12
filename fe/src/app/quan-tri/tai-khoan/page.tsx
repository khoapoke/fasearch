"use client";

import { useEffect, useState } from "react";
import { MgmtShell } from "@/components/mgmt/mgmt-shell";
import account from "@/components/account/account.module.css";
import mgmt from "@/components/mgmt/mgmt.module.css";
import { beFetch, beWrite, trangThaiTaiKhoan, unwrap, type Page } from "@/lib/mgmt-client";

type AdminAccount = {
  maTk: number;
  tenDangNhap: string;
  email: string;
  trangThai: string;
  tenVaiTro: string;
  loaiHoSo: string;
  khachHang: { id: number; hoTen: string; sdt: string } | null;
  nhanVien: { maNv: number; ho: string | null; ten: string; sdt: string } | null;
};

type Notice = { kind: "ok" | "err"; text: string } | null;

function profileLabel(row: AdminAccount): string {
  if (row.nhanVien) return `${row.nhanVien.ho ?? ""} ${row.nhanVien.ten}`.trim();
  if (row.khachHang) return row.khachHang.hoTen;
  return "—";
}

export default function AdminAccountsPage() {
  const [q, setQ] = useState("");
  const [vaiTro, setVaiTro] = useState("");
  const [trangThai, setTrangThai] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page<AdminAccount> | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    let live = true;
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (vaiTro) query.set("vaiTro", vaiTro);
    if (trangThai) query.set("trangThai", trangThai);
    query.set("page", String(page));
    query.set("size", "20");
    beFetch(`v1/admin/accounts?${query.toString()}`)
      .then((response) => unwrap<Page<AdminAccount>>(response))
      .then((result) => {
        if (live) {
          setData(result);
          setNotice(null);
        }
      })
      .catch((e: unknown) => {
        if (live) setNotice({ kind: "err", text: e instanceof Error ? e.message : "Tải thất bại." });
      });
    return () => {
      live = false;
    };
  }, [q, vaiTro, trangThai, page, reloadKey]);

  async function act(id: number, path: string, method: "POST" | "DELETE", confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusyId(id);
    try {
      const response = await beWrite(`v1/admin/accounts/${id}${path}`, method);
      await unwrap(response);
      setNotice({ kind: "ok", text: "Thao tác thành công." });
      reload();
    } catch (e) {
      setNotice({ kind: "err", text: e instanceof Error ? e.message : "Thao tác thất bại." });
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(id: number, username: string) {
    const next = window.prompt(`Mật khẩu mới cho ${username} (tối thiểu 15 ký tự):`);
    if (!next) return;
    setBusyId(id);
    try {
      const response = await beWrite(`v1/admin/accounts/${id}/mat-khau`, "POST", {
        matKhauMoi: next,
      });
      await unwrap(response);
      setNotice({ kind: "ok", text: `Đã đặt lại mật khẩu cho ${username}, mọi phiên cũ hết hiệu lực.` });
      reload();
    } catch (e) {
      setNotice({ kind: "err", text: e instanceof Error ? e.message : "Đặt lại thất bại." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <MgmtShell
      title="Quản trị tài khoản"
      lede="Danh sách, tạo, sửa, khóa/xóa mềm, đặt lại mật khẩu và thu hồi phiên (FR01–07). Xóa là xóa mềm — không mất lịch sử."
      need={["ADMIN"]}
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
          Tìm (tên/username/SĐT/email)
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
        </label>
        <label>
          Vai trò
          <select value={vaiTro} onChange={(e) => setVaiTro(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="ADMIN">ADMIN</option>
            <option value="STAFF">STAFF</option>
            <option value="CUSTOMER">CUSTOMER</option>
          </select>
        </label>
        <label>
          Trạng thái
          <select value={trangThai} onChange={(e) => setTrangThai(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="HOAT_DONG">Hoạt động</option>
            <option value="KHOA">Đã khóa</option>
            <option value="DA_XOA">Đã xóa</option>
          </select>
        </label>
        <button className={account.primary} type="submit">
          Lọc
        </button>
        <button type="button" className={account.secondary} onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Đóng form tạo" : "Tạo tài khoản"}
        </button>
      </form>

      {notice && (
        <p className={account.muted} role={notice.kind === "err" ? "alert" : "status"}>
          {notice.kind === "err" ? "Lỗi: " : "OK: "}
          {notice.text}
        </p>
      )}
      {showCreate && <CreateForm onDone={() => { setShowCreate(false); reload(); }} />}

      {!data && <p className={account.muted}>Đang tải…</p>}
      {data && data.data.length === 0 && <p className={account.muted}>Không có tài khoản nào.</p>}
      {data && data.data.length > 0 && (
        <>
          <div className={mgmt.tableWrap}>
            <table className={mgmt.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username / Email</th>
                  <th>Hồ sơ</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((row) => (
                  <tr key={row.maTk}>
                    <td>{row.maTk}</td>
                    <td>
                      <b>{row.tenDangNhap}</b>
                      <br />
                      {row.email}
                    </td>
                    <td>{profileLabel(row)}</td>
                    <td>{row.tenVaiTro}</td>
                    <td>
                      <span
                        className={
                          row.trangThai === "HOAT_DONG"
                            ? mgmt.badge
                            : row.trangThai === "KHOA"
                              ? mgmt.badge + " " + mgmt.badgeWarn
                              : mgmt.badge + " " + mgmt.badgeMuted
                        }
                      >
                        {trangThaiTaiKhoan(row.trangThai)}
                      </span>
                    </td>
                    <td>
                      <div className={mgmt.rowActions}>
                        <EditForm row={row} onDone={reload} />
                        {row.trangThai === "HOAT_DONG" && (
                          <button
                            className={mgmt.linkButton}
                            disabled={busyId === row.maTk}
                            onClick={() =>
                              act(row.maTk, "/khoa", "POST", `Khóa ${row.tenDangNhap}? Phiên hiện tại hết hiệu lực ngay.`)
                            }
                          >
                            Khóa
                          </button>
                        )}
                        {row.trangThai === "KHOA" && (
                          <button
                            className={mgmt.linkButton}
                            disabled={busyId === row.maTk}
                            onClick={() => act(row.maTk, "/mo-khoa", "POST", `Mở khóa ${row.tenDangNhap}?`)}
                          >
                            Mở khóa
                          </button>
                        )}
                        {row.trangThai !== "DA_XOA" && (
                          <button
                            className={mgmt.linkButton + " " + mgmt.danger}
                            disabled={busyId === row.maTk}
                            onClick={() =>
                              act(row.maTk, "", "DELETE", `XÓA MỀM ${row.tenDangNhap}? Không đăng nhập được nữa. ADMIN cuối được bảo vệ.`)
                            }
                          >
                            Xóa
                          </button>
                        )}
                        <button
                          className={mgmt.linkButton}
                          disabled={busyId === row.maTk}
                          onClick={() => resetPassword(row.maTk, row.tenDangNhap)}
                        >
                          Đặt MK
                        </button>
                        <button
                          className={mgmt.linkButton}
                          disabled={busyId === row.maTk}
                          onClick={() =>
                            act(row.maTk, "/phien", "DELETE", `Thu hồi mọi phiên của ${row.tenDangNhap}?`)
                          }
                        >
                          Thu hồi phiên
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
              Trang {data.page + 1}/{Math.max(data.totalPages, 1)} — {data.totalElements} tài khoản
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
  const [kind, setKind] = useState<"CUSTOMER" | "STAFF">("CUSTOMER");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setSaving(true);
    setError(null);
    try {
      const role = kind === "CUSTOMER" ? "CUSTOMER" : "STAFF";
      const body: Record<string, unknown> = {
        tenDangNhap: String(form.get("tenDangNhap")),
        matKhau: String(form.get("matKhau")),
        email: String(form.get("email")),
        vaiTro: role,
        loaiHoSo: kind,
      };
      if (kind === "CUSTOMER") {
        body.hoSoKhachHang = {
          ho: emptyNull(form.get("ho")),
          ten: String(form.get("ten")),
          sdt: String(form.get("sdt")),
        };
      } else {
        body.hoSoNhanVien = {
          ho: emptyNull(form.get("ho")),
          ten: String(form.get("ten")),
          sdt: String(form.get("sdt")),
          cccd: String(form.get("cccd")),
        };
      }
      const response = await beWrite("v1/admin/accounts", "POST", body);
      await unwrap(response);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo thất bại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={account.card} aria-label="Tạo tài khoản">
      <p className={account.greeting}>Tạo tài khoản + hồ sơ (nguyên tử)</p>
      <form
        className={mgmt.formGrid}
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        <label>
          Loại hồ sơ
          <select value={kind} onChange={(e) => setKind(e.target.value as "CUSTOMER" | "STAFF")}>
            <option value="CUSTOMER">Khách hàng</option>
            <option value="STAFF">Nhân viên (STAFF)</option>
          </select>
        </label>
        <label>
          Tên đăng nhập*
          <input name="tenDangNhap" required minLength={3} maxLength={50} />
        </label>
        <label>
          Mật khẩu* (≥15 ký tự)
          <input name="matKhau" type="password" required minLength={15} maxLength={64} />
        </label>
        <label>
          Email*
          <input name="email" type="email" required maxLength={100} />
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
        {kind === "STAFF" && (
          <label>
            CCCD* (nhân viên bắt buộc)
            <input name="cccd" required maxLength={20} />
          </label>
        )}
        <div className={mgmt.fullRow}>
          <button className={account.primary} type="submit" disabled={saving}>
            {saving ? "Đang tạo…" : "Tạo tài khoản"}
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

function EditForm({ row, onDone }: { row: AdminAccount; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      const email = String(form.get("email") ?? "").trim();
      if (email && email !== row.email) body.email = email;
      const role = String(form.get("vaiTro") ?? "");
      if (role && role !== row.tenVaiTro) body.vaiTro = role;
      const response = await beWrite(`v1/admin/accounts/${row.maTk}`, "PATCH", body);
      await unwrap(response);
      setOpen(false);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sửa thất bại.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className={mgmt.linkButton} onClick={() => setOpen(true)}>
        Sửa
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
      style={{ display: "grid", gap: 6, minWidth: 220 }}
    >
      <label>
        Email
        <input name="email" type="email" defaultValue={row.email} maxLength={100} />
      </label>
      <label>
        Vai trò (hiệu lực ngay)
        <select name="vaiTro" defaultValue={row.tenVaiTro}>
          <option value="ADMIN">ADMIN</option>
          <option value="STAFF">STAFF</option>
          <option value="CUSTOMER">CUSTOMER</option>
        </select>
      </label>
      <div className={mgmt.rowActions}>
        <button className={mgmt.linkButton} type="submit" disabled={saving}>
          {saving ? "Đang lưu…" : "Lưu"}
        </button>
        <button className={mgmt.linkButton} type="button" onClick={() => setOpen(false)}>
          Hủy
        </button>
      </div>
      {error && <span role="alert">{error}</span>}
    </form>
  );
}

function emptyNull(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}
