"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { AdminShell } from "@/components/admin/admin-shell";
import { beFetch, beWrite, unwrap, type Page } from "@/lib/mgmt-client";

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

function profileName(row: AdminAccount): string {
  if (row.nhanVien) return `${row.nhanVien.ho ?? ""} ${row.nhanVien.ten}`.trim();
  if (row.khachHang) return row.khachHang.hoTen;
  return row.tenDangNhap;
}

function profilePhone(row: AdminAccount): string {
  if (row.nhanVien) return row.nhanVien.sdt;
  if (row.khachHang) return row.khachHang.sdt;
  return "—";
}

const AVATAR_COLORS = ["#4338ca", "#0ea5e9", "#d97706", "#059669", "#64748b", "#dc2626"];

function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
    <AdminShell
      active="accounts"
      crumbs={[{ label: "Hệ thống" }, { label: "Quản trị tài khoản" }, { label: "Danh sách tài khoản" }]}
      title="Quản trị tài khoản người dùng"
      tag="ENTERPRISE IAM"
      lede="Quản lý tài khoản truy cập, phân quyền theo vai trò (ADMIN/STAFF/CUSTOMER), kiểm soát trạng thái và giám sát phiên vận hành hệ thống FashionSearch AI."
      actions={
        <>
          <button className="adBtn" type="button">
            <Icon name="upload" size={16} /> Xuất dữ liệu
          </button>
          <button className="adBtn adBtnPrimary" type="button" onClick={() => setShowCreate((v) => !v)}>
            <Icon name="plus" size={16} /> {showCreate ? "Đóng form tạo" : "Thêm tài khoản mới"}
          </button>
        </>
      }
    >
      <section className="adStats" aria-label="Tổng quan tài khoản">
        <div className="adStat">
          <div><p>Tổng tài khoản</p><b>{data?.totalElements ?? "…"}</b><small className="adStatOk">Máy chủ trực tiếp</small></div>
          <span className="adStatIco"><Icon name="user" size={22} /></span>
        </div>
        <div className="adStat">
          <div><p>Vai trò hỗ trợ</p><b>3</b><small>ADMIN · STAFF · CUSTOMER</small></div>
          <span className="adStatIco"><Icon name="shield" size={22} /></span>
        </div>
        <div className="adStat">
          <div><p>Hoạt động (trang này)</p><b>{data ? data.data.filter((r) => r.trangThai === "HOAT_DONG").length : "…"}</b><small className="adStatOk">Khả dụng ổn định</small></div>
          <span className="adStatIco"><Icon name="check" size={22} /></span>
        </div>
        <div className="adStat">
          <div><p>Khóa/xóa (trang này)</p><b>{data ? data.data.filter((r) => r.trangThai !== "HOAT_DONG").length : "…"}</b><small className="adStatBad">Cần kiểm tra</small></div>
          <span className="adStatIco"><Icon name="lock" size={22} /></span>
        </div>
      </section>

      {showCreate && <CreateForm onDone={() => { setShowCreate(false); reload(); }} />}

      <div className="adCard">
        <form
          className="adFilters"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            reload();
          }}
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
            placeholder="Họ tên, username, email, SĐT…"
            aria-label="Tìm tài khoản"
          />
          <select value={vaiTro} onChange={(e) => setVaiTro(e.target.value)} aria-label="Vai trò">
            <option value="">Tất cả vai trò</option>
            <option value="ADMIN">ADMIN</option>
            <option value="STAFF">STAFF</option>
            <option value="CUSTOMER">CUSTOMER</option>
          </select>
          <select value={trangThai} onChange={(e) => setTrangThai(e.target.value)} aria-label="Trạng thái">
            <option value="">Tất cả trạng thái</option>
            <option value="HOAT_DONG">Hoạt động</option>
            <option value="KHOA">Đã khóa</option>
            <option value="DA_XOA">Đã xóa</option>
          </select>
          <button className="adBtn" type="submit">Lọc</button>
        </form>
        {notice ? (
          <p className="adMono" role={notice.kind === "err" ? "alert" : "status"} style={{ marginTop: 10, color: notice.kind === "err" ? "#ba1a1a" : "#047857" }}>
            {notice.kind === "err" ? "Lỗi: " : "OK: "}{notice.text}
          </p>
        ) : null}
      </div>

      <div className="adCard">
        {!data ? (
          <p className="adState" role="status">Đang tải danh sách tài khoản…</p>
        ) : data.data.length === 0 ? (
          <p className="adState">Không có tài khoản nào khớp bộ lọc.</p>
        ) : (
          <>
            <div className="adTableWrap">
              <table className="adTable">
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Email &amp; tài khoản</th>
                    <th>Số điện thoại</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row) => {
                    const name = profileName(row);
                    return (
                      <tr key={row.maTk}>
                        <td>
                          <span className="adWho">
                            <span className="adAvatar" style={{ background: avatarColor(name) }} aria-hidden="true">
                              {initialsOf(name)}
                            </span>
                            <b>{name}</b>
                          </span>
                        </td>
                        <td>
                          <span className="adMono">{row.email}</span>
                          <br />
                          <span className="adMono" style={{ color: "#4338ca" }}>@{row.tenDangNhap}</span>
                        </td>
                        <td className="adMono">{profilePhone(row)}</td>
                        <td><span className="adRole">{roleLabel(row.tenVaiTro)}</span></td>
                        <td>
                          {row.trangThai === "HOAT_DONG" ? (
                            <span className="adStatusLive">Hoạt động</span>
                          ) : row.trangThai === "KHOA" ? (
                            <span className="adStatusLock">Đã khóa</span>
                          ) : (
                            <span className="adMono">Đã xóa</span>
                          )}
                        </td>
                        <td>
                          <div className="adRowBtns">
                            <EditForm row={row} onDone={reload} />
                            {row.trangThai === "HOAT_DONG" ? (
                              <button className="adBtn" type="button" disabled={busyId === row.maTk}
                                onClick={() => act(row.maTk, "/khoa", "POST", `Khóa ${row.tenDangNhap}? Phiên hiện tại hết hiệu lực ngay.`)}>Khóa</button>
                            ) : row.trangThai === "KHOA" ? (
                              <button className="adBtn" type="button" disabled={busyId === row.maTk}
                                onClick={() => act(row.maTk, "/mo-khoa", "POST", `Mở khóa ${row.tenDangNhap}?`)}>Mở khóa</button>
                            ) : null}
                            {row.trangThai !== "DA_XOA" ? (
                              <button className="adBtn" type="button" disabled={busyId === row.maTk}
                                onClick={() => act(row.maTk, "", "DELETE", `XÓA MỀM ${row.tenDangNhap}? Không đăng nhập được nữa. ADMIN cuối được bảo vệ.`)}>Xóa</button>
                            ) : null}
                            <button className="adBtn" type="button" disabled={busyId === row.maTk}
                              onClick={() => resetPassword(row.maTk, row.tenDangNhap)}>Đặt MK</button>
                            <button className="adBtn" type="button" disabled={busyId === row.maTk}
                              onClick={() => act(row.maTk, "/phien", "DELETE", `Thu hồi mọi phiên của ${row.tenDangNhap}?`)}>Thu hồi phiên</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="adPager">
              <span className="adMono">Hiển thị {data.data.length} trong số {data.totalElements} kết quả</span>
              {page > 0 ? <button className="adBtn" type="button" onClick={() => setPage(page - 1)}>‹</button> : null}
              <span className="pg" aria-current="page">{page + 1}</span>
              {page + 1 < data.totalPages ? <button className="adBtn" type="button" onClick={() => setPage(page + 1)}>›</button> : null}
            </div>
          </>
        )}
      </div>
      <p className="adNote">Chính sách kiểm soát quyền (RBAC) áp dụng đúng 3 vai trò máy chủ: ADMIN · STAFF · CUSTOMER. Mọi thao tác khóa/xóa/đặt lại mật khẩu đều ghi audit.</p>
    </AdminShell>
  );
}

function roleLabel(role: string): string {
  if (role === "ADMIN") return "Quản trị viên";
  if (role === "STAFF") return "Nhân viên";
  return "Khách hàng";
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
    <section className="adCard" aria-label="Tạo tài khoản">
      <h2 style={{ fontSize: 15 }}>Tạo tài khoản + hồ sơ (nguyên tử)</h2>
      <form
        className="adFilters"
        style={{ marginTop: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        <select value={kind} onChange={(e) => setKind(e.target.value as "CUSTOMER" | "STAFF")} aria-label="Loại hồ sơ">
          <option value="CUSTOMER">Khách hàng</option>
          <option value="STAFF">Nhân viên (STAFF)</option>
        </select>
        <input name="tenDangNhap" required minLength={3} maxLength={50} placeholder="Tên đăng nhập*" aria-label="Tên đăng nhập" />
        <input name="matKhau" type="password" required minLength={15} maxLength={64} placeholder="Mật khẩu* (≥15 ký tự)" aria-label="Mật khẩu" />
        <input name="email" type="email" required maxLength={100} placeholder="Email*" aria-label="Email" />
        <input name="ho" maxLength={50} placeholder="Họ" aria-label="Họ" />
        <input name="ten" required maxLength={50} placeholder="Tên*" aria-label="Tên" />
        <input name="sdt" required maxLength={15} placeholder="SĐT*" aria-label="SĐT" />
        {kind === "STAFF" ? <input name="cccd" required maxLength={20} placeholder="CCCD* (nhân viên)" aria-label="CCCD" /> : null}
        <button className="adBtn adBtnPrimary" type="submit" disabled={saving}>
          {saving ? "Đang tạo…" : "Tạo tài khoản"}
        </button>
        {error ? <p role="alert" style={{ color: "#ba1a1a", fontSize: 13 }}>Lỗi: {error}</p> : null}
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
      <button className="adBtn" type="button" onClick={() => setOpen(true)}>
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
      <input name="email" type="email" defaultValue={row.email} maxLength={100} aria-label="Email" />
      <select name="vaiTro" defaultValue={row.tenVaiTro} aria-label="Vai trò">
        <option value="ADMIN">ADMIN</option>
        <option value="STAFF">STAFF</option>
        <option value="CUSTOMER">CUSTOMER</option>
      </select>
      <div className="adRowBtns">
        <button className="adBtn adBtnPrimary" type="submit" disabled={saving}>
          {saving ? "Đang lưu…" : "Lưu"}
        </button>
        <button className="adBtn" type="button" onClick={() => setOpen(false)}>Hủy</button>
      </div>
      {error ? <span role="alert" style={{ fontSize: 12 }}>{error}</span> : null}
    </form>
  );
}

function emptyNull(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}
