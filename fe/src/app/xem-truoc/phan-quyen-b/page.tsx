"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { AdminShell } from "@/components/admin/admin-shell";

// Biến thể 2 của màn RBAC trong source (bố cục bảng module + thao tác nhanh).
// Tách preview riêng theo TASK; route thường dùng biến thể 1.
const MODULES = [
  { name: "Dashboard & Thống kê", note: "Export XLS" },
  { name: "Danh mục & Sản phẩm", note: "Duyệt Batch" },
  { name: "Quản lý Kho & Nhập hàng", note: "Duyệt Phiếu" },
  { name: "Quản lý Đơn hàng & Vận chuyển", note: "Hoàn tiền" },
  { name: "Voucher & Khuyến mãi", note: "Kích hoạt" },
  { name: "Khách hàng & Hội viên", note: "Export PII" },
  { name: "Cấu hình AI & Vector Search", note: "Re-index" },
  { name: "Cài đặt & Hạ tầng", note: "Flush Cache" },
];
const COLS = ["Xem (Read)", "Thêm (Create)", "Sửa (Update)", "Xóa (Delete)", "Phê duyệt / Export"];

export default function RbacVariantB() {
  const [cells, setCells] = useState<boolean[][]>(MODULES.map(() => [true, true, true, false, true]));
  const [discarded, setDiscarded] = useState(false);

  function flip(r: number, c: number) {
    setCells((prev) => prev.map((row, i) => (i === r ? row.map((v, j) => (j === c ? !v : v)) : row)));
    setDiscarded(false);
  }

  function selectModule(r: number, on: boolean) {
    setCells((prev) => prev.map((row, i) => (i === r ? row.map(() => on) : row)));
    setDiscarded(false);
  }

  return (
    <AdminShell
      crumbs={[{ label: "Hệ thống" }, { label: "Phân quyền" }, { label: "Biến thể B (preview)" }]}
      title="Phân quyền & Quản lý vai trò — biến thể B"
      tag="PREVIEW VARIANT"
      lede="Biến thể trình bày thứ hai trong source. Mọi chỉnh sửa chỉ đổi trên trình duyệt."
      actions={
        <button className="adBtn" type="button" onClick={() => { setCells(MODULES.map(() => [true, true, true, false, true])); setDiscarded(true); }}>
          Hủy thay đổi
        </button>
      }
      previewNote="Preview tách riêng. Trang phân quyền thường đã được gỡ để không bị hiểu nhầm là cấu hình thật; máy chủ chỉ có ADMIN/STAFF/CUSTOMER."
    >
      <div className="adCard">
        {discarded ? <p className="adMono" role="status">Đã hủy thay đổi preview, ma trận về mặc định minh họa.</p> : null}
        <div className="adTableWrap">
          <table className="adTable">
            <thead>
              <tr><th>Module / Chức năng hệ thống</th>{COLS.map((c) => <th key={c}>{c}</th>)}<th>Thao tác nhanh</th></tr>
            </thead>
            <tbody>
              {MODULES.map((m, r) => (
                <tr key={m.name}>
                  <td><b style={{ fontSize: 13 }}>{m.name}</b><br /><span className="adMono">{m.note}</span></td>
                  {COLS.map((c, col) => (
                    <td key={c}>
                      <input type="checkbox" checked={cells[r][col]} onChange={() => flip(r, col)} aria-label={`${c} — ${m.name} (preview)`} style={{ width: 18, height: 18, accentColor: "#4338ca" }} />
                    </td>
                  ))}
                  <td>
                    <button className="adBtn" type="button" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => selectModule(r, true)}>Chọn cả module</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 10 }}><Link className="adBtn" href="/quan-tri"><Icon name="chevronRight" size={15} /> Về Không gian quản trị</Link></p>
      </div>
    </AdminShell>
  );
}
