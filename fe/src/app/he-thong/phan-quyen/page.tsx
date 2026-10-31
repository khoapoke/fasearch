"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { AdminShell } from "@/components/admin/admin-shell";

// Route thường cho phân quyền: bố cục theo biến thể 1 của source.
// Máy chủ chỉ có 3 vai trò ADMIN/STAFF/CUSTOMER — mọi vai trò tùy biến
// trong ảnh source đều chưa được hỗ trợ; ma trận chỉ chỉnh trên trình duyệt.
const MODULES = [
  "Dashboard & Thống kê",
  "Danh mục & Sản phẩm",
  "Quản lý Kho & Nhập hàng",
  "Quản lý Đơn hàng & Vận chuyển",
  "Voucher & Khuyến mãi",
  "Khách hàng & Hội viên",
  "Cấu hình AI & Vector Search",
  "Cài đặt & Hạ tầng",
];
const COLS = ["Xem", "Thêm", "Sửa", "Xóa", "Phê duyệt"];

const REAL_ROLES = [
  { id: "ADMIN", name: "Quản trị viên", desc: "Toàn quyền quản trị hệ thống", accounts: "—" },
  { id: "STAFF", name: "Nhân viên", desc: "Quản lý danh mục, sản phẩm, khách hàng", accounts: "—" },
  { id: "CUSTOMER", name: "Khách hàng", desc: "Mua sắm, quản lý tài khoản cá nhân", accounts: "—" },
];

const SEED: Record<string, boolean[]> = {
  "Dashboard & Thống kê": [true, false, false, false, true],
  "Danh mục & Sản phẩm": [true, true, true, false, true],
  "Quản lý Kho & Nhập hàng": [true, true, true, false, true],
  "Quản lý Đơn hàng & Vận chuyển": [true, true, true, false, true],
  "Voucher & Khuyến mãi": [true, true, true, true, true],
  "Khách hàng & Hội viên": [true, true, true, false, true],
  "Cấu hình AI & Vector Search": [true, true, true, false, true],
  "Cài đặt & Hạ tầng": [true, false, true, false, false],
};

export default function RbacPage() {
  const [role, setRole] = useState("ADMIN");
  const [matrix, setMatrix] = useState(SEED);
  const [saved, setSaved] = useState(true);

  function flip(module: string, col: number) {
    setMatrix((prev) => ({ ...prev, [module]: prev[module].map((v, i) => (i === col ? !v : v)) }));
    setSaved(false);
  }

  return (
    <AdminShell
      active="rbac"
      crumbs={[{ label: "Hệ thống" }, { label: "Phân quyền" }, { label: "Quản lý vai trò & Quyền hạn (RBAC)" }]}
      title="Phân quyền & Quản lý vai trò"
      tag="RBAC SECURITY MATRIX"
      lede="Thiết lập phân quyền chi tiết theo mô hình RBAC. Bản xem trước: chỉnh sửa chỉ lưu trên trình duyệt, chưa ghi máy chủ."
      actions={
        <>
          <button className="adBtn" type="button" onClick={() => { setMatrix(SEED); setSaved(true); }}>Đặt về mặc định</button>
          <button className="adBtn adBtnPrimary" type="button" onClick={() => setSaved(true)}>
            <Icon name="check" size={16} /> {saved ? "Đã lưu (preview)" : "Lưu phân quyền"}
          </button>
        </>
      }
      previewNote="Máy chủ chỉ hỗ trợ 3 vai trò ADMIN/STAFF/CUSTOMER — 6 vai trò tùy biến (Super Admin, Manager, Warehouse…) trong ảnh source chưa được hỗ trợ. Biến thể còn lại: /xem-truoc/phan-quyen-b."
    >
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, alignItems: "start" }} className="rbacGrid">
        <div className="adCard" aria-label="Danh sách vai trò">
          <h2 style={{ fontSize: 15 }}>Danh sách vai trò · 3 vai trò máy chủ</h2>
          {REAL_ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id)}
              aria-pressed={role === r.id}
              style={{
                display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                border: role === r.id ? "2px solid #4338ca" : "1px solid #e5e4f5",
                borderRadius: 12, padding: 12, marginTop: 10, background: role === r.id ? "#f4f2ff" : "#fff",
              }}
            >
              <b style={{ fontSize: 14 }}>{r.name}</b>
              <p className="adMono">ROLE_{r.id}</p>
              <p className="mpMuted" style={{ fontSize: 12.5 }}>{r.desc}</p>
            </button>
          ))}
          <p className="mpMuted" style={{ fontSize: 12.5, marginTop: 10 }}>
            Vai trò tùy biến trong ảnh source (Super Admin, Quản lý kho, CSKH, Kế toán) cần quyết định
            kiến trúc BE — ghi ở CONTRACT_GAPS, không tự tạo ở FE.
          </p>
        </div>

        <div className="adCard" aria-label="Ma trận quyền">
          <h2 style={{ fontSize: 15 }}>Ma trận quyền hạn vai trò: {role}</h2>
          <p className="mpMuted">Ma trận minh họa khả năng theo vai trò máy chủ hiện tại.</p>
          <div className="adTableWrap">
            <table className="adTable">
              <thead>
                <tr><th>Module &amp; chức năng</th>{COLS.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {MODULES.map((m) => (
                  <tr key={m}>
                    <td><b style={{ fontSize: 13 }}>{m}</b></td>
                    {COLS.map((c, i) => (
                      <td key={c}>
                        <input
                          type="checkbox"
                          checked={matrix[m][i]}
                          onChange={() => flip(m, i)}
                          aria-label={`${c} — ${m} (preview)`}
                          style={{ width: 18, height: 18, accentColor: "#4338ca" }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!saved ? <p className="adMono" style={{ marginTop: 10 }}>● Có thay đổi chưa lưu (preview — lưu chỉ đổi trạng thái hiển thị).</p> : null}
        </div>
      </div>
      <p className="adNote">Hệ thống tuân thủ phân quyền đúng 3 vai trò máy chủ. Nhật ký phân quyền gần đây xem ở trang Nhật ký hệ thống.</p>
      <style>{`@media (max-width: 1024px){ .rbacGrid{ grid-template-columns: 1fr !important; } }`}</style>
    </AdminShell>
  );
}
