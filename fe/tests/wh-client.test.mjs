// Warehouse client: khóa tạm, nhãn phiếu, ánh xạ lỗi giữ nguyên status BE.
// Run: node --test tests/wh-client.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  loaiPhieuLabel,
  newKhoaTam,
  trangThaiPhieuLabel,
  whReadError,
} from "../src/lib/wh-client.ts";

describe("newKhoaTam", () => {
  it("đúng bound contract 8..64 ký tự [A-Za-z0-9_-]", () => {
    for (let i = 0; i < 50; i += 1) {
      const k = newKhoaTam();
      assert.ok(k.length >= 8 && k.length <= 64, k);
      assert.match(k, /^[A-Za-z0-9_-]+$/);
    }
  });

  it("mỗi lần gọi khác nhau (chống double-submit trùng khóa vô ý)", () => {
    const seen = new Set([newKhoaTam(), newKhoaTam(), newKhoaTam()]);
    assert.equal(seen.size, 3);
  });
});

describe("labels", () => {
  it("đủ 5 loại phiếu + 3 trạng thái", () => {
    assert.equal(loaiPhieuLabel("NHAP_NCC"), "Nhập NCC");
    assert.equal(loaiPhieuLabel("XUAT_HUY"), "Xuất hủy");
    assert.equal(loaiPhieuLabel("CHUYEN_KHO"), "Chuyển kho");
    assert.equal(loaiPhieuLabel("KIEM_KE"), "Kiểm kê");
    assert.equal(loaiPhieuLabel("CAN_BANG"), "Cân bằng");
    assert.equal(trangThaiPhieuLabel("BAN_NHAP"), "Bản nháp");
    assert.equal(trangThaiPhieuLabel("DA_XAC_NHAN"), "Đã xác nhận");
    assert.equal(trangThaiPhieuLabel("DA_HUY"), "Đã hủy");
  });
});

describe("whReadError", () => {
  it("401 → GUEST, giữ status", async () => {
    const e = await whReadError(
      new Response(JSON.stringify({ success: false, code: 401, message: "Hết phiên" }), { status: 401 }),
    );
    assert.equal(e.status, 401);
    assert.equal(e.code, "GUEST");
    assert.match(e.message, /STAFF\/ADMIN/);
  });

  it("403 → FORBIDDEN, giữ status", async () => {
    const e = await whReadError(
      new Response(JSON.stringify({ success: false, code: 403, message: "Cấm" }), { status: 403 }),
    );
    assert.equal(e.status, 403);
    assert.equal(e.code, "FORBIDDEN");
  });

  it("409 giữ message BE + hướng dẫn tải lại, không retry ngầm", async () => {
    const e = await whReadError(
      new Response(JSON.stringify({ success: false, code: 409, message: "Tồn kho không đủ" }), { status: 409 }),
    );
    assert.equal(e.status, 409);
    assert.equal(e.code, "CONFLICT");
    assert.match(e.message, /Tồn kho không đủ/);
    assert.match(e.message, /tải lại/i);
  });

  it("400 giữ errors[] từng field", async () => {
    const e = await whReadError(
      new Response(
        JSON.stringify({
          success: false,
          code: 400,
          message: "Dữ liệu không hợp lệ",
          errors: [{ field: "soLuong", reason: "phải > 0" }],
        }),
        { status: 400 },
      ),
    );
    assert.equal(e.errors.length, 1);
    assert.equal(e.errors[0].field, "soLuong");
  });

  it("body không phải JSON → message mặc định theo status", async () => {
    const e = await whReadError(new Response("<html>bad gateway</html>", { status: 502 }));
    assert.equal(e.status, 502);
    assert.match(e.message, /502/);
  });
});
