// Quản trị/catalog client helpers (server authoritative, FE chỉ unwrap + format).
// Run: node --test tests/mgmt-client.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { unwrap, vnd, trangThaiTaiKhoan, trangThaiSanPham } from "../src/lib/mgmt-client.ts";

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("vnd", () => {
  it("định dạng tiền Việt, null/NaN thành gạch ngang", () => {
    assert.equal(vnd(150000), "150.000 ₫");
    assert.equal(vnd("20000"), "20.000 ₫");
    assert.equal(vnd(null), "—");
    assert.equal(vnd(undefined), "—");
    assert.equal(vnd("abc"), "—");
  });
});

describe("trangThai mapping", () => {
  it("map đúng vocabulary BE, lạ giữ nguyên", () => {
    assert.equal(trangThaiTaiKhoan("HOAT_DONG"), "Hoạt động");
    assert.equal(trangThaiTaiKhoan("KHOA"), "Đã khóa");
    assert.equal(trangThaiTaiKhoan("DA_XOA"), "Đã xóa");
    assert.equal(trangThaiSanPham("DANG_BAN"), "Đang bán");
    assert.equal(trangThaiSanPham("NGUNG_KD"), "Ngừng kinh doanh");
    assert.equal(trangThaiSanPham("LA"), "LA");
  });
});

describe("unwrap", () => {
  it("trả result khi envelope ok", async () => {
    const response = jsonResponse(200, {
      success: true,
      code: 200,
      message: "ok",
      result: { maSp: 7 },
    });
    assert.deepEqual(await unwrap(response), { maSp: 7 });
  });

  it("nối message + field errors khi BE 409", async () => {
    const response = jsonResponse(409, {
      success: false,
      code: 409,
      message: "Trùng",
      result: null,
      errors: [{ field: "tenDanhMuc", reason: "Đã tồn tại" }],
    });
    await assert.rejects(() => unwrap(response), /Trùng: Đã tồn tại/);
  });

  it("báo HTTP status khi body không phải envelope", async () => {
    const response = new Response("<html/>", {
      status: 502,
      headers: { "content-type": "text/html" },
    });
    await assert.rejects(() => unwrap(response), /HTTP 502/);
  });
});
