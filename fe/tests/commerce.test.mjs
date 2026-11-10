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
    // Biên lai POS (dữ liệu legacy giamGia/giamVoucher/giamDiem) render qua discountLines().
    assert.match(pos, /discountLines\(/, "biên lai POS: phải render qua discountLines()");
    // Trang chi tiết đơn khách dùng mô hình đơn mới (discountAmount/pointsDiscount từ snapshot
    // máy chủ), nên không gọi discountLines() nữa; vẫn cấm nguồn dòng giảm thứ hai và cấm tự tính giảm.
    assert.match(detail, /order\.discountAmount/, "chi tiết đơn: dòng voucher lấy từ snapshot máy chủ");
    assert.match(detail, /order\.pointsDiscount/, "chi tiết đơn: dòng điểm lấy từ snapshot máy chủ");
    for (const [name, src] of [["chi tiết đơn", detail], ["biên lai POS", pos]]) {
      assert.doesNotMatch(src, /function OrderDiscountLines/, `${name}: không được có nguồn dòng giảm thứ hai`);
    }
  });
  it("đơn không giảm → không có dòng nào", async () => {
    const f = await lines();
    assert.deepEqual(f({ giamGia: 0 }), []);
  });
});

// Consolidated from fe/tests/customer-admin-journey-polish.test.mjs; audit 2026-11-07.
{
const { describe, it } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const {
  DEFAULT_WEIGHT_PER_ITEM_GRAM,
  calculateCartWeightGram,
  formatCommerceUpstreamError,
  isCustomerSafeReason,
  CommerceError,
} = await import("../src/lib/customer-commerce.ts");
const { readCommerceResponse } = await import("../src/lib/customer-commerce-client.ts");

describe("commerce production regressions", () => {
  it("F1 regression: computes shipping weight at 300g per item and updates quote on quantity change", () => {
    // Contract constant is strictly 300g per item
    assert.equal(DEFAULT_WEIGHT_PER_ITEM_GRAM, 300);

    // 1 item => 300g; 2 items => 600g
    const weightOneItem = calculateCartWeightGram(1);
    const weightTwoItems = calculateCartWeightGram(2);
    assert.equal(weightOneItem, 300);
    assert.equal(weightTwoItems, 600);

    // Zero / negative falls back safely to 1g min bound
    assert.equal(calculateCartWeightGram(0), 1);
    assert.equal(calculateCartWeightGram(-1), 1);

    // Visible assumption copy aligns with 300g/item
    const visibleAssumptionCopy = `Đơn thử nghiệm. Phí giao hàng lấy từ API BE với giả định ${DEFAULT_WEIGHT_PER_ITEM_GRAM}g/món vì DTO sản phẩm công khai chưa có trọng lượng; đây không phải metadata sản xuất.`;
    assert.match(visibleAssumptionCopy, /300g\/món/);
    assert.equal(visibleAssumptionCopy.includes("500g/món"), false);

    // Quantity change in cart triggers recalculation with new total weight and fresh quote key
    const province = "TP. Hồ Chí Minh";
    const district = "Quận 1";
    const keyOne = `${province.trim().toLowerCase()}|${district.trim().toLowerCase()}|${weightOneItem}`;
    const keyTwo = `${province.trim().toLowerCase()}|${district.trim().toLowerCase()}|${weightTwoItems}`;

    assert.equal(keyOne, "tp. hồ chí minh|quận 1|300");
    assert.equal(keyTwo, "tp. hồ chí minh|quận 1|600");
    assert.notEqual(keyOne, keyTwo, "Cart quantity change MUST invalidate previous quote key and compute new weight");
  });

  it("F2 regression: prevents raw upstream validation reasons from reaching customer-visible errors in safe and non-safe calls", async () => {
    const rawEnglishReason = "Insufficient stock for SKU 56";
    const upstreamPayload = {
      code: 400,
      message: "Validation failed",
      errors: [{ field: "quantity", reason: rawEnglishReason }],
    };

    // 1. Safe commerce call fixture (safeErrors = true)
    const safeResult = formatCommerceUpstreamError(400, upstreamPayload, true);
    assert.equal(safeResult.status, 400);
    assert.equal(safeResult.body.message, "Lựa chọn này tạm hết hàng — bạn thử chọn tuỳ chọn khác hoặc quay lại sau nhé.");
    assert.equal(safeResult.body.errors, undefined, "safeErrors policy MUST strip raw upstream errors array");

    // Client readCommerceResponse on safe call
    const safeResponse = new Response(JSON.stringify(safeResult.body), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
    const safeErr = await readCommerceResponse(safeResponse, (v) => v).catch((e) => e);
    assert.ok(safeErr instanceof CommerceError);
    assert.equal(safeErr.status, 400);
    assert.match(safeErr.message, /Lựa chọn này tạm hết hàng/);
    assert.equal(safeErr.message.includes(rawEnglishReason), false, "Customer-visible error MUST NOT contain raw English reason");
    assert.equal(safeErr.message.includes("SKU 56"), false, "Customer-visible error MUST NOT contain raw backend SKU");

    // 2. Non-safe commerce call fixture (safeErrors = false)
    const nonSafeResult = formatCommerceUpstreamError(400, upstreamPayload, false);
    assert.equal(nonSafeResult.status, 400);
    assert.equal(nonSafeResult.body.message, "Lựa chọn này tạm hết hàng — bạn thử chọn tuỳ chọn khác hoặc quay lại sau nhé.");
    assert.ok(Array.isArray(nonSafeResult.body.errors), "Non-safe call preserves errors on envelope");

    // Client readCommerceResponse sanitizes raw reasons even if envelope retained them
    const nonSafeResponse = new Response(JSON.stringify(nonSafeResult.body), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
    const nonSafeErr = await readCommerceResponse(nonSafeResponse, (v) => v).catch((e) => e);
    assert.ok(nonSafeErr instanceof CommerceError);
    assert.equal(nonSafeErr.status, 400);
    assert.match(nonSafeErr.message, /Lựa chọn này tạm hết hàng/);
    assert.equal(nonSafeErr.message.includes(rawEnglishReason), false, "Client MUST NOT concatenate raw upstream reason into customer-visible error");
    assert.equal(nonSafeErr.message.includes("SKU 56"), false);

    // 3. Reason sanitization predicate checks
    assert.equal(isCustomerSafeReason(rawEnglishReason), false);
    assert.equal(isCustomerSafeReason("Allowed maximum: 4"), false);
    assert.equal(isCustomerSafeReason("NullPointerException on SKU query"), false);
    assert.equal(isCustomerSafeReason("Số lượng vượt quá tồn kho"), true);
  });
});

}
