"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MgmtShell } from "@/components/mgmt/mgmt-shell";
import account from "@/components/account/account.module.css";
import mgmt from "@/components/mgmt/mgmt.module.css";
import {
  beFetch,
  beWrite,
  trangThaiSanPham,
  unwrap,
  vnd,
  type Page,
} from "@/lib/mgmt-client";

type Product = {
  maSp: number;
  tenSp: string;
  maDanhMuc: number | null;
  tenDanhMuc: string | null;
  giaBan: number;
  giaNhap: number | null;
  trangThai: string;
  daXoa: boolean;
  coHinhAnh: boolean;
};

type Category = { maDanhMuc: number; tenDanhMuc: string };

export default function ProductsPage() {
  const [q, setQ] = useState("");
  const [maDanhMuc, setMaDanhMuc] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page<Product> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    beFetch("v1/danh-muc")
      .then((r) => unwrap<Category[]>(r))
      .then(setCategories)
      .catch(() => {});
  }, []);

  const [reloadKey, setReloadKey] = useState(0);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    let live = true;
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (maDanhMuc) query.set("maDanhMuc", maDanhMuc);
    query.set("page", String(page));
    query.set("size", "20");
    beFetch(`v1/san-pham?${query.toString()}`)
      .then((response) => unwrap<Page<Product>>(response))
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
  }, [q, maDanhMuc, page, reloadKey]);

  async function toggleHide(row: Product) {
    const action = row.trangThai === "DANG_BAN" ? "an" : "hien-thi";
    const label = row.trangThai === "DANG_BAN" ? "Tạm ẩn" : "Hiện lại";
    if (!window.confirm(`${label} "${row.tenSp}"?`)) return;
    try {
      await unwrap(await beWrite(`v1/san-pham/${row.maSp}/${action}`, "POST"));
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Thao tác thất bại.");
    }
  }

  async function softDelete(row: Product) {
    if (!window.confirm(`XÓA MỀM "${row.tenSp}"? Hàng ẩn khỏi catalog nhưng giữ lịch sử.`))
      return;
    try {
      await unwrap(await beWrite(`v1/san-pham/${row.maSp}`, "DELETE"));
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Xóa thất bại.");
    }
  }

  return (
    <MgmtShell
      title="Quản lý sản phẩm"
      lede="Danh sách, lọc thật, tạo/sửa/ẩn/xóa mềm sản phẩm (FR09–12). Giá nhập quản trị thấy, catalog công khai không."
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
          Tìm theo tên
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
        </label>
        <label>
          Danh mục
          <select value={maDanhMuc} onChange={(e) => setMaDanhMuc(e.target.value)}>
            <option value="">Tất cả</option>
            {categories.map((c) => (
              <option key={c.maDanhMuc} value={c.maDanhMuc}>
                {c.tenDanhMuc}
              </option>
            ))}
          </select>
        </label>
        <button className={account.primary} type="submit">
          Lọc
        </button>
        <button type="button" className={account.secondary} onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Đóng form tạo" : "Tạo sản phẩm"}
        </button>
      </form>
      {notice && (
        <p className={account.muted} role="alert">
          Lỗi: {notice}
        </p>
      )}
      {showCreate && (
        <CreateForm categories={categories} onDone={() => { setShowCreate(false); reload(); }} />
      )}
      {!data && <p className={account.muted}>Đang tải…</p>}
      {data && data.data.length === 0 && <p className={account.muted}>Không có sản phẩm nào.</p>}
      {data && data.data.length > 0 && (
        <>
          <div className={mgmt.tableWrap}>
            <table className={mgmt.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tên / Danh mục</th>
                  <th>Giá bán / Giá nhập</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((row) => (
                  <tr key={row.maSp}>
                    <td>{row.maSp}</td>
                    <td>
                      <b>{row.tenSp}</b>
                      <br />
                      {row.tenDanhMuc ?? "—"}
                      {row.coHinhAnh ? " · có ảnh" : ""}
                    </td>
                    <td>
                      {vnd(row.giaBan)}
                      <br />
                      Nhập: {row.giaNhap === null ? "chưa có" : vnd(row.giaNhap)}
                    </td>
                    <td>
                      <span
                        className={
                          row.daXoa
                            ? mgmt.badge + " " + mgmt.badgeMuted
                            : row.trangThai === "DANG_BAN"
                              ? mgmt.badge
                              : mgmt.badge + " " + mgmt.badgeWarn
                        }
                      >
                        {row.daXoa ? "Đã xóa" : trangThaiSanPham(row.trangThai)}
                      </span>
                    </td>
                    <td>
                      <div className={mgmt.rowActions}>
                        <Link className={mgmt.linkButton} href={`/quan-tri/san-pham/${row.maSp}`}>
                          Chi tiết
                        </Link>
                        {!row.daXoa && (
                          <>
                            <button className={mgmt.linkButton} onClick={() => toggleHide(row)}>
                              {row.trangThai === "DANG_BAN" ? "Tạm ẩn" : "Hiện lại"}
                            </button>
                            <button
                              className={mgmt.linkButton + " " + mgmt.danger}
                              onClick={() => softDelete(row)}
                            >
                              Xóa
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={mgmt.pager}>
            <span>
              Trang {data.page + 1}/{Math.max(data.totalPages, 1)} — {data.totalElements} sản phẩm
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

function CreateForm({
  categories,
  onDone,
}: {
  categories: Category[];
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setSaving(true);
    setError(null);
    try {
      const body = {
        tenSp: String(form.get("tenSp")),
        maDanhMuc: Number(form.get("maDanhMuc")),
        chatLieu: emptyNull(form.get("chatLieu")),
        kieuDang: emptyNull(form.get("kieuDang")),
        moTa: emptyNull(form.get("moTa")),
        giaBan: Number(form.get("giaBan")),
        giaNhap: Number(form.get("giaNhap")),
      };
      const response = await beWrite("v1/san-pham", "POST", body);
      await unwrap(response);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo thất bại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={account.card} aria-label="Tạo sản phẩm">
      <p className={account.greeting}>Tạo sản phẩm mới (FR10 — bắt buộc giá nhập)</p>
      <form
        className={mgmt.formGrid}
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        <label className={mgmt.fullRow}>
          Tên sản phẩm*
          <input name="tenSp" required maxLength={255} />
        </label>
        <label>
          Danh mục*
          <select name="maDanhMuc" required defaultValue="">
            <option value="" disabled>
              Chọn danh mục
            </option>
            {categories.map((c) => (
              <option key={c.maDanhMuc} value={c.maDanhMuc}>
                {c.tenDanhMuc}
              </option>
            ))}
          </select>
        </label>
        <label>
          Giá bán (VND)*
          <input name="giaBan" required inputMode="decimal" />
        </label>
        <label>
          Giá nhập (VND)*
          <input name="giaNhap" required inputMode="decimal" />
        </label>
        <label>
          Chất liệu
          <input name="chatLieu" maxLength={100} />
        </label>
        <label>
          Kiểu dáng
          <input name="kieuDang" maxLength={100} />
        </label>
        <label className={mgmt.fullRow}>
          Mô tả
          <textarea name="moTa" />
        </label>
        <div className={mgmt.fullRow}>
          <button className={account.primary} type="submit" disabled={saving}>
            {saving ? "Đang tạo…" : "Tạo sản phẩm"}
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

function emptyNull(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}
