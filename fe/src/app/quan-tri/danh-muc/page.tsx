"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { StitchImage } from "@/components/ui/stitch-image";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { beFetch, beWrite, unwrap } from "@/lib/mgmt-client";
import { stitchImages } from "@/lib/stitch-assets";

type Category = { maDanhMuc: number; tenDanhMuc: string; soSanPham: number };

function slugOf(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function CategoriesPage() {
  const [data, setData] = useState<Category[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<Category | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const thumbs = useMemo(() => stitchImages("fashionsearch_ai_qu_n_l_danh_m_c_s_n_ph_m"), []);

  useEffect(() => {
    let live = true;
    beFetch("v1/danh-muc")
      .then((response) => unwrap<Category[]>(response))
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
  }, [reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await unwrap(await beWrite("v1/danh-muc", "POST", { tenDanhMuc: name.trim() }));
      setName("");
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Tạo thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Category) {
    if (
      !window.confirm(
        `Xóa danh mục "${row.tenDanhMuc}"? Danh mục còn sản phẩm sẽ bị từ chối (409) để giữ dữ liệu.`,
      )
    )
      return;
    try {
      await unwrap(await beWrite(`v1/danh-muc/${row.maDanhMuc}`, "DELETE"));
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Xóa thất bại.");
    }
  }

  async function rename(next: string) {
    if (!renaming || !next.trim()) return;
    setBusy(true);
    try {
      await unwrap(
        await beWrite(`v1/danh-muc/${renaming.maDanhMuc}`, "PATCH", {
          tenDanhMuc: next.trim(),
        }),
      );
      setRenaming(null);
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Đổi tên thất bại.");
    } finally {
      setBusy(false);
    }
  }

  const rows = (data ?? []).filter((r) =>
    q.trim() ? r.tenDanhMuc.toLowerCase().includes(q.trim().toLowerCase()) : true,
  );

  return (
    <MerchantShell
      active="categories"
      topActions={
        <button className="mpTopBtn primary" type="button" onClick={() => document.getElementById("mp-cat-name")?.focus()}>
          <Icon name="plus" size={16} /> Thêm mới
        </button>
      }
    >
      <div className="mpCard">
        <form
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <div className="mpSearch" style={{ maxWidth: 420 }}>
            <Icon name="search" size={17} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm kiếm tên danh mục, mã định danh slug…"
              aria-label="Tìm danh mục"
            />
          </div>
          <div className="mpSearch" style={{ maxWidth: 320 }}>
            <Icon name="plus" size={17} />
            <input
              id="mp-cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={150}
              placeholder="Tên danh mục mới…"
              aria-label="Tên danh mục mới"
            />
          </div>
          <button className="mpTopBtn primary" type="submit" disabled={busy || !name.trim()}>
            Thêm danh mục
          </button>
          <button className="mpTopBtn" type="button" onClick={reload}>
            <Icon name="refresh" size={16} /> Làm mới
          </button>
          <button
            className="mpTopBtn"
            type="button"
            onClick={() => {
              const lines = ["ma_danh_muc,ten_danh_muc,so_san_pham", ...(data ?? []).map((r) => `${r.maDanhMuc},"${r.tenDanhMuc.replace(/"/g, '""')}",${r.soSanPham}`)];
              const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "danh-muc.csv";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            <Icon name="upload" size={16} /> Xuất CSV
          </button>
        </form>
        {notice ? (
          <p className="mpMuted" role="alert" style={{ color: "#ba1a1a", marginTop: 10 }}>
            Lỗi: {notice}
          </p>
        ) : null}
      </div>

      <div className="mpCard">
        {!data ? (
          <p className="mpMuted" role="status">Đang tải danh mục…</p>
        ) : rows.length === 0 ? (
          <p className="mpMuted">Chưa có danh mục nào{data.length ? " khớp tìm kiếm" : ""}.</p>
        ) : (
          <div className="mpTableWrap">
            <table className="mpTable">
              <thead>
                <tr>
                  <th>Ảnh</th>
                  <th>Tên danh mục &amp; slug</th>
                  <th>Mã</th>
                  <th>Sản phẩm liên kết</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.maDanhMuc}>
                    <td>
                      <StitchImage
                        src={thumbs[i % Math.max(thumbs.length, 1)]?.src}
                        alt={`Ảnh minh họa ${row.tenDanhMuc}`}
                        className="mpThumb"
                      />
                    </td>
                    <td>
                      {renaming?.maDanhMuc === row.maDanhMuc ? (
                        <RenameInline
                          initial={row.tenDanhMuc}
                          onSave={rename}
                          onCancel={() => setRenaming(null)}
                        />
                      ) : (
                        <>
                          <b>{row.tenDanhMuc}</b>
                          <p className="mpMuted" style={{ fontFamily: "monospace", fontSize: 12 }}>
                            {slugOf(row.tenDanhMuc)}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="adMono">#{row.maDanhMuc}</td>
                    <td>
                      <b>{row.soSanPham}</b> <span className="mpMuted">sản phẩm</span>
                    </td>
                    <td>
                      <div className="mpRowBtns" style={{ justifyContent: "flex-end" }}>
                        <button className="mpIconBtn" type="button" aria-label={`Đổi tên ${row.tenDanhMuc}`} onClick={() => setRenaming(row)}>
                          <Icon name="edit" size={17} />
                        </button>
                        <button className="mpIconBtn" type="button" aria-label={`Xóa ${row.tenDanhMuc}`} onClick={() => remove(row)}>
                          <Icon name="trash" size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MerchantShell>
  );
}

function RenameInline({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (next: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      style={{ display: "flex", gap: 6 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
    >
      <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={150} aria-label="Tên mới" />
      <button className="mpTopBtn" type="submit">Lưu</button>
      <button className="mpTopBtn" type="button" onClick={onCancel}>Hủy</button>
    </form>
  );
}
