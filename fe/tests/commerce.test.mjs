// Run: node --test tests/commerce.test.mjs (from fe/)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildOrderQuery, buildStaffOrderQuery, commerceErrorMessage, formatVndContract,
  voucherChosenLabel,
  isCustomerCancellable, newOperationKey, nextOnlineState, orderStatusLabel,
  paymentMethodLabel, paymentStatusLabel, validateCancelReason, validateCashTender,
  validateQuantity, validateReceiver,
} from "../src/lib/commerce.ts";

describe("operation keys", () => {
  it("unique per payload", () => {
    const a = newOperationKey();
    const b = newOperationKey();
    assert.ok(a && b && a !== b);
  });
});

describe("status labels", () => {
  it("covers online sequence + POS draft", () => {
    assert.equal(orderStatusLabel("MOI_TAO"), "Mới tạo");
    assert.equal(orderStatusLabel("DA_GIAO_VAN_CHUYEN"), "Đã giao vận chuyển");
    assert.equal(orderStatusLabel("TAM_LUU"), "Tạm lưu (POS)");
    assert.equal(paymentStatusLabel("CHUA_THANH_TOAN"), "Chưa thanh toán");
    assert.equal(paymentMethodLabel("TIEN_MAT"), "Tiền mặt (POS)");
  });
  it("next state follows approved sequence", () => {
    assert.equal(nextOnlineState("MOI_TAO"), "DA_XAC_NHAN");
    assert.equal(nextOnlineState("HOAN_THANH"), null);
    assert.equal(nextOnlineState("DA_HUY"), null);
  });
  it("customer cancel only MOI_TAO + allowed action", () => {
    assert.equal(isCustomerCancellable({ trangThai: "MOI_TAO", hanhDongChoPhep: ["HUY"] }), true);
    assert.equal(isCustomerCancellable({ trangThai: "DA_XAC_NHAN", hanhDongChoPhep: ["HUY"] }), false);
    assert.equal(isCustomerCancellable({ trangThai: "MOI_TAO", hanhDongChoPhep: [] }), false);
  });
});

describe("validation", () => {
  it("quantity 1..999 integer", () => {
    assert.equal(validateQuantity(3), 3);
    assert.throws(() => validateQuantity(0), /1–999/);
    assert.throws(() => validateQuantity(1000), /1–999/);
    assert.throws(() => validateQuantity(1.5), /1–999/);
  });
  it("receiver requires name/phone/address", () => {
    assert.throws(() => validateReceiver("", "0901234567", "HCM"), /người nhận/);
    assert.throws(() => validateReceiver("A", "123", "HCM"), /9–11/);
    assert.throws(() => validateReceiver("A", "0901234567", ""), /địa chỉ/);
  });
  it("cancel reason required", () => {
    assert.equal(validateCancelReason(" đổi ý "), "đổi ý");
    assert.throws(() => validateCancelReason("  "), /lý do/);
  });
  it("cash tender must cover due, integer dong", () => {
    assert.equal(validateCashTender("200000", 150000), 200000);
    assert.equal(validateCashTender("150.000", 150000), 150000);
    assert.throws(() => validateCashTender("100000", 150000), /chưa đủ/);
    assert.throws(() => validateCashTender("0", 10), /dương/);
    assert.throws(() => validateCashTender("abc", 10), /dương/);
  });
});

describe("paging + errors", () => {
  it("bounds page/size", () => {
    assert.ok(buildOrderQuery({ page: -1, size: 500 }).includes("size=100"));
    assert.ok(buildStaffOrderQuery({ page: 0, size: 20, sdt: "090" }).includes("sdt=090"));
  });
  it("409 asks refresh, 404 honest", () => {
    assert.match(commerceErrorMessage(409, "x"), /Tải lại/);
    assert.match(commerceErrorMessage(404, "x"), /Không tìm thấy/);
    assert.equal(formatVndContract(150000), "150.000₫");
  });
});

describe("voucherChosenLabel (R5: mã voucher bị nhả sau khi hủy)", () => {
  it("có mã thì hiện #id, không có mã thì không in # rỗng", () => {
    assert.equal(voucherChosenLabel(5), "Voucher #5");
    assert.equal(voucherChosenLabel(5, " (đã chốt)"), "Voucher #5 (đã chốt)");
    assert.equal(voucherChosenLabel(null), "Voucher");
    assert.equal(voucherChosenLabel(undefined, " (đã chốt)"), "Voucher (đã chốt)");
  });
});

describe("withSessionRetry (phiên chưa ghi xong ngay sau đăng nhập)", () => {
  it("retry đúng một lần khi 401 rồi trả kết quả", async () => {
    const { withSessionRetry } = await import("../src/lib/commerce-client.ts");
    let calls = 0;
    const value = await withSessionRetry(async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("401"), { status: 401 });
      return "ok";
    });
    assert.equal(value, "ok");
    assert.equal(calls, 2);
  });
  it("không retry lỗi khác 401", async () => {
    const { withSessionRetry } = await import("../src/lib/commerce-client.ts");
    let calls = 0;
    await assert.rejects(withSessionRetry(async () => {
      calls += 1;
      throw Object.assign(new Error("403"), { status: 403 });
    }), /403/);
    assert.equal(calls, 1);
  });
});

describe("discountLines (nhãn giảm theo snapshot máy chủ)", () => {
  const lines = async () => (await import("../src/lib/commerce.ts")).discountLines;
  it("đơn có snapshot → tách dòng voucher và điểm", async () => {
    const f = await lines();
    const out = f({ giamGia: 33000, giamVoucher: 30000, giamDiem: 3000, diemSuDung: 3, maVoucher: 5 });
    assert.equal(out.length, 2);
    assert.match(out[0].label, /Voucher #5/);
    assert.equal(out[0].amount, 30000);
    assert.match(out[1].label, /Điểm đã dùng \(3\)/);
    assert.equal(out[1].amount, 3000);
  });
  it("đơn legacy (phanBoGiamXacDinh=false) → chỉ tổng giảm, không gán nhãn voucher/điểm", async () => {
    const f = await lines();
    const out = f({ phanBoGiamXacDinh: false, giamGia: 33000, giamVoucher: null, giamDiem: null, diemSuDung: 3 });
    assert.equal(out.length, 1);
    assert.match(out[0].label, /chưa xác định phân bổ/);
    assert.equal(out[0].amount, 33000);
  });
  it("đơn legacy không có giảm (giamGia=0) → không dòng 0đ", async () => {
    const f = await lines();
    assert.deepEqual(f({ phanBoGiamXacDinh: false, giamGia: 0, giamVoucher: null, giamDiem: null, diemSuDung: 0 }), []);
  });
  it("phản hồi cũ chưa có cờ → đúng một dòng 'Giảm giá'", async () => {
    const f = await lines();
    const out = f({ giamGia: 15000, giamVoucher: null, giamDiem: null, diemSuDung: 0, maVoucher: null });
    assert.equal(out.length, 1);
    assert.equal(out[0].label, "Giảm giá");
    assert.equal(out[0].amount, 15000);
  });
  it("bố cục trang chi tiết đơn: một nguồn dòng giảm duy nhất", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const detail = readFileSync(join(root, "src/app/don-hang/[id]/page.tsx"), "utf8");
    const pos = readFileSync(join(root, "src/app/kenh-ban/pos/page.tsx"), "utf8");
    for (const [name, src] of [["chi tiết đơn", detail], ["biên lai POS", pos]]) {
      assert.match(src, /discountLines\(/, `${name}: phải render qua discountLines()`);
      assert.doesNotMatch(src, /function OrderDiscountLines/, `${name}: không được có nguồn dòng giảm thứ hai`);
    }
  });
  it("đơn không giảm → không có dòng nào", async () => {
    const f = await lines();
    assert.deepEqual(f({ giamGia: 0 }), []);
  });
});
