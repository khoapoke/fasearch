// Run: node --test tests/pos-receipt.test.mjs (from fe/)
// Red-capable: BE pay result may be nested {donHang, maHoaDon, tienThua}
// (observed live 18/10) or flat {...order, maHoaDon, tienThua}.
// FE must never crash render on receipt.items.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizePosReceipt } from "../src/lib/commerce-client.ts";

const line = { maSku: 2, maSp: 1, tenSpSnapshot: "Áo", mauSacSnapshot: "Đen", kichCoSnapshot: "L", soLuong: 1, donGia: 150000, tongDong: 150000 };
const order = {
  maDonHang: 14, kenhBan: "POS", trangThai: "HOAN_THANH", phienBan: 2, maKho: 1,
  items: [line], tongTienHang: 150000, giamGia: 0, phiVanChuyen: 0, tongThanhToan: 150000,
  trangThaiThanhToan: "DA_THANH_TOAN", phuongThucThanhToan: "TIEN_MAT",
  maHoaDon: 10, lichSu: [], hanhDongChoPhep: [],
};

describe("normalizePosReceipt", () => {
  it("nested {donHang, maHoaDon, tienThua} -> flat with items (no render crash)", () => {
    const r = normalizePosReceipt({ donHang: { ...order, maHoaDon: undefined }, maHoaDon: 10, tienThua: 50000 });
    assert.equal(r.maDonHang, 14);
    assert.equal(r.maHoaDon, 10);
    assert.equal(r.tienThua, 50000);
    assert.deepEqual(r.items, [line]);
  });

  it("flat shape keeps working", () => {
    const r = normalizePosReceipt({ ...order, tienThua: 50000 });
    assert.equal(r.maDonHang, 14);
    assert.equal(r.items.length, 1);
  });

  it("missing items throws honest error instead of render crash", () => {
    assert.throws(() => normalizePosReceipt({ maHoaDon: 1 }), /thiếu dòng hàng/);
    assert.throws(() => normalizePosReceipt(null), /thiếu dòng hàng/);
  });
});
