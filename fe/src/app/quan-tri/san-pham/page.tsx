"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant/merchant-shell";
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
    <MerchantShell
      active="products"
      topActions={
        <button className="mpTopBtn primary" type="button" onClick={() => setShowCreate((v) => !v)}>
          + {showCreate ? "Đóng form tạo" : "Tạo sản phẩm"}
        </button>
      }
    >
      <div className="mpCard">
        <h2>Quản lý sản phẩm</h2>
        <p className="mpMuted">Danh sách, lọc thật, tạo/sửa/ẩn/xóa mềm. Giá nhập quản trị thấy, catalog công khai không.</p>
        <form
          style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            reload();
          }}
        >
          <div className="mpSearch" style={{ maxWidth: 300 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} placeholder="Tìm theo tên…" aria-label="Tìm theo tên" />
          </div>
          <select value={maDanhMuc} onChange={(e) => setMaDanhMuc(e.target.value)} aria-label="Danh mục" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "9px 12px", fontSize: 13 }}>
            <option value="">Tất cả cấp bậc</option>
            {categories.map((c) => (
              <option key={c.maDanhMuc} value={c.maDanhMuc}>
                {c.tenDanhMuc}
              </option>
            ))}
          </select>
          <button className="mpTopBtn primary" type="submit">Lọc</button>
        </form>
        {notice ? <p className="mpMuted" role="alert" style={{ color: "#ba1a1a", marginTop: 8 }}>Lỗi: {notice}</p> : null}
      </div>

      {showCreate && <CreateForm categories={categories} onDone={() => { setShowCreate(false); reload(); }} />}

      <div className="mpCard">
        {!data ? (
          <p className="mpMuted" role="status">Đang tải…</p>
        ) : data.data.length === 0 ? (
          <p className="mpMuted">Không có sản phẩm nào.</p>
        ) : (
          <>
            <div className="mpTableWrap">
              <table className="mpTable">
                <thead>
                  <tr>
                    <th>Ảnh</th>
                    <th>Tên / Danh mục</th>
                    <th>Giá bán / Giá nhập</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row) => (
                    <tr key={row.maSp}>
                      <td>
                        {row.coHinhAnh ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="mpThumb" src={`/api/be/v1/san-pham/${row.maSp}/hinh-anh`} alt="" loading="lazy" />
                        ) : (
                          <span className="mpThumb" aria-label="Chưa có ảnh" />
                        )}
                      </td>
                      <td>
                        <b>{row.tenSp}</b>
                        <p className="mpMuted">{row.tenDanhMuc ?? "—"}{row.coHinhAnh ? " · có ảnh" : ""}</p>
                      </td>
                      <td>
                        {vnd(row.giaBan)}
                        <p className="mpMuted">Nhập: {row.giaNhap === null ? "chưa có" : vnd(row.giaNhap)}</p>
                      </td>
                      <td>
                        <span className={"mpPill" + (row.daXoa ? "" : row.trangThai === "DANG_BAN" ? " mpPillLive" : " mpPillWarn")}>
                          {row.daXoa ? "Đã xóa" : trangThaiSanPham(row.trangThai)}
                        </span>
                      </td>
                      <td>
                        <div className="mpRowBtns" style={{ justifyContent: "flex-end" }}>
                          <Link className="mpTopBtn" style={{ padding: "7px 12px", fontSize: 12.5 }} href={`/quan-tri/san-pham/${row.maSp}`}>
                            Chi tiết
                          </Link>
                          {!row.daXoa && (
                            <>
                              <button className="mpTopBtn" style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={() => toggleHide(row)}>
                                {row.trangThai === "DANG_BAN" ? "Tạm ẩn" : "Hiện lại"}
                              </button>
                              <button className="mpTopBtn" style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={() => softDelete(row)}>
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
            <p className="mpMuted" style={{ marginTop: 10 }}>
              Trang {data.page + 1}/{Math.max(data.totalPages, 1)} — {data.totalElements} sản phẩm
              {page > 0 ? <button className="mpTopBtn" style={{ marginLeft: 8 }} onClick={() => setPage(page - 1)}>Trước</button> : null}
              {page + 1 < data.totalPages ? <button className="mpTopBtn" style={{ marginLeft: 8 }} onClick={() => setPage(page + 1)}>Sau</button> : null}
            </p>
          </>
        )}
      </div>
    </MerchantShell>
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
    <section className="mpCard" aria-label="Tạo sản phẩm">
      <h2>Tạo sản phẩm mới (bắt buộc giá nhập)</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}
      >
        <label style={{ gridColumn: "1/-1" }}>
          Tên sản phẩm*
          <input name="tenSp" required maxLength={255} style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginTop: 4 }} />
        </label>
        <label>
          Danh mục*
          <select name="maDanhMuc" required defaultValue="" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginTop: 4 }}>
            <option value="" disabled>Chọn danh mục</option>
            {categories.map((c) => (
              <option key={c.maDanhMuc} value={c.maDanhMuc}>{c.tenDanhMuc}</option>
            ))}
          </select>
        </label>
        <label>
          Giá bán (VND)*
          <input name="giaBan" required inputMode="decimal" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginTop: 4 }} />
        </label>
        <label>
          Giá nhập (VND)*
          <input name="giaNhap" required inputMode="decimal" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginTop: 4 }} />
        </label>
        <label>
          Chất liệu
          <input name="chatLieu" maxLength={100} style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginTop: 4 }} />
        </label>
        <label>
          Kiểu dáng
          <input name="kieuDang" maxLength={100} style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginTop: 4 }} />
        </label>
        <label style={{ gridColumn: "1/-1" }}>
          Mô tả
          <textarea name="moTa" style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginTop: 4 }} />
        </label>
        <div style={{ gridColumn: "1/-1" }}>
          <button className="mpTopBtn primary" type="submit" disabled={saving}>
            {saving ? "Đang tạo…" : "Tạo sản phẩm"}
          </button>
          {error ? <p role="alert" style={{ color: "#ba1a1a", marginTop: 8 }}>Lỗi: {error}</p> : null}
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
