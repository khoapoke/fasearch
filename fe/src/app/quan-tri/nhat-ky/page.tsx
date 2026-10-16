"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { AdminShell } from "@/components/admin/admin-shell";
import { beFetch, unwrap, type Page } from "@/lib/mgmt-client";

type Audit = {
  maNhatKy: number;
  maTk: number | null;
  tenDangNhap: string | null;
  thoiGian: string;
  hanhDong: string;
  duLieuThayDoi: string | null;
};

export default function AuditPage() {
  const [hanhDong, setHanhDong] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const [data, setData] = useState<Page<Audit> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    let live = true;
    const query = new URLSearchParams();
    if (hanhDong) query.set("hanhDong", hanhDong);
    query.set("page", String(page));
    query.set("size", "20");
    beFetch(`v1/admin/nhat-ky?${query.toString()}`)
      .then((response) => unwrap<Page<Audit>>(response))
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
  }, [hanhDong, page, reloadKey]);

  return (
    <AdminShell
      active="audit"
      crumbs={[{ label: "Hệ thống" }, { label: "Nhật ký hệ thống" }]}
      title="Nhật ký hệ thống"
      tag="AUDIT TRAIL · LIVE"
      lede="Vết Thêm/Sửa/Xóa của quản trị. Mới nhất trước; không chứa mật khẩu/hash/token."
      actions={
        <button className="adBtn" type="button" onClick={reload}>
          <Icon name="refresh" size={16} /> Làm mới
        </button>
      }
    >
      <div className="adCard">
      <form
        className="adFilters"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          reload();
        }}
      >
        <label>
          Hành động
          <input
            value={hanhDong}
            onChange={(e) => setHanhDong(e.target.value.toUpperCase())}
            placeholder="TAO_TAI_KHOAN…"
            maxLength={60}
          />
        </label>
        <button className="adBtn adBtnPrimary" type="submit">
          Lọc
        </button>
      </form>
      {notice && (
        <p className="adMono" role="alert" style={{ color: "#ba1a1a" }}>
          Lỗi: {notice}
        </p>
      )}
      {!data && <p className="adState" role="status">Đang tải nhật ký…</p>}
      {data && data.data.length === 0 && <p className="adState">Chưa có vết nào.</p>}
      </div>
      {data && data.data.length > 0 && (
      <div className="adCard">
          <div className="adTableWrap">
            <table className="adTable">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Thời gian</th>
                  <th>Actor</th>
                  <th>Hành động</th>
                  <th>Thay đổi</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((row) => (
                  <tr key={row.maNhatKy}>
                    <td><button className="adBtn" style={{ padding: "4px 10px", fontSize: 12 }} aria-expanded={openId === row.maNhatKy} onClick={() => setOpenId(openId === row.maNhatKy ? null : row.maNhatKy)}>#{row.maNhatKy}</button></td>
                    <td>{new Date(row.thoiGian).toLocaleString("vi-VN")}</td>
                    <td>
                      {row.tenDangNhap ?? `#${row.maTk ?? "?"}`}
                    </td>
                    <td>
                      <span className="adRole">{row.hanhDong}</span>
                    </td>
                    <td style={{ maxWidth: 420, overflowWrap: "anywhere" }}>
                      {(row.duLieuThayDoi ?? "—").slice(0, 90)}
                      <div className="collapse" data-open={openId === row.maNhatKy}>
                        <div>
                          <pre className="adMono" style={{ whiteSpace: "pre-wrap", fontSize: 11.5, background: "#f4f2ff", borderRadius: 8, padding: 10, marginTop: 6 }}>{prettyAudit(row.duLieuThayDoi)}</pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="adPager">
            <span className="adMono">
              Trang {data.page + 1}/{Math.max(data.totalPages, 1)} — {data.totalElements} vết
            </span>
            {page > 0 && (
              <button className="adBtn" type="button" onClick={() => setPage(page - 1)}>
                Trước
              </button>
            )}
            {page + 1 < data.totalPages && (
              <button className="adBtn" type="button" onClick={() => setPage(page + 1)}>
                Sau
              </button>
            )}
          </div>
      </div>
      )}
    </AdminShell>
  );
}

function prettyAudit(raw: string | null): string {
  if (!raw) return "—";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2).slice(0, 2000);
  } catch {
    return raw.slice(0, 2000);
  }
}
