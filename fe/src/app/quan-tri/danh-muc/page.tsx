"use client";

import { useEffect, useState } from "react";
import { MgmtShell } from "@/components/mgmt/mgmt-shell";
import account from "@/components/account/account.module.css";
import mgmt from "@/components/mgmt/mgmt.module.css";
import { beFetch, beWrite, unwrap } from "@/lib/mgmt-client";

type Category = { maDanhMuc: number; tenDanhMuc: string; soSanPham: number };

export default function CategoriesPage() {
  const [data, setData] = useState<Category[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<Category | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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

  return (
    <MgmtShell
      title="Quản lý danh mục"
      lede="Xem, thêm, sửa, xóa danh mục (FR08). Tên trùng → 409; danh mục còn sản phẩm → 409, không xóa ngầm."
      need={["ADMIN", "STAFF"]}
    >
      <form
        className={mgmt.toolbar}
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <label>
          Tên danh mục mới
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />
        </label>
        <button className={account.primary} type="submit" disabled={busy || !name.trim()}>
          Thêm
        </button>
      </form>
      {notice && (
        <p className={account.muted} role="alert">
          Lỗi: {notice}
        </p>
      )}
      {!data && <p className={account.muted}>Đang tải…</p>}
      {data && data.length === 0 && <p className={account.muted}>Chưa có danh mục nào.</p>}
      {data && data.length > 0 && (
        <div className={mgmt.tableWrap}>
          <table className={mgmt.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên danh mục</th>
                <th>Số sản phẩm</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.maDanhMuc}>
                  <td>{row.maDanhMuc}</td>
                  <td>
                    {renaming?.maDanhMuc === row.maDanhMuc ? (
                      <RenameInline
                        initial={row.tenDanhMuc}
                        onSave={rename}
                        onCancel={() => setRenaming(null)}
                      />
                    ) : (
                      <b>{row.tenDanhMuc}</b>
                    )}
                  </td>
                  <td>{row.soSanPham}</td>
                  <td>
                    <div className={mgmt.rowActions}>
                      <button className={mgmt.linkButton} onClick={() => setRenaming(row)}>
                        Đổi tên
                      </button>
                      <button
                        className={mgmt.linkButton + " " + mgmt.danger}
                        onClick={() => remove(row)}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MgmtShell>
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
      <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={150} />
      <button className={mgmt.linkButton} type="submit">
        Lưu
      </button>
      <button className={mgmt.linkButton} type="button" onClick={onCancel}>
        Hủy
      </button>
    </form>
  );
}
