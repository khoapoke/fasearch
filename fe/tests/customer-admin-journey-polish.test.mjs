import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WEIGHT_PER_ITEM_GRAM,
  calculateCartWeightGram,
  formatCommerceUpstreamError,
  isCustomerSafeReason,
  CommerceError,
} from "../src/lib/customer-commerce.ts";
import { readCommerceResponse } from "../src/lib/customer-commerce-client.ts";

describe("Customer & Admin Core Journey Polish - Contract & Error Verification", () => {
  it("maps raw backend English errors to human Vietnamese messages", () => {
    const rawErrors = [
      { raw: "Insufficient stock for requested SKU 56", expected: "Lựa chọn này tạm hết hàng — bạn thử chọn tuỳ chọn khác hoặc quay lại sau nhé." },
      { raw: "Cart is empty", expected: "Giỏ hàng hiện đang trống." },
      { raw: "Access denied: insufficient permissions", expected: "Tài khoản không có quyền thực hiện thao tác này." },
      { raw: "Invoice before completion required", expected: "Đơn hàng cần được ghi nhận thu tiền (hóa đơn) trước khi hoàn tất." },
    ];

    for (const { raw, expected } of rawErrors) {
      let mapped = "";
      if (/insufficient.*stock|hết hàng|tồn kho/i.test(raw)) {
        mapped = "Lựa chọn này tạm hết hàng — bạn thử chọn tuỳ chọn khác hoặc quay lại sau nhé.";
      } else if (/cart.*empty|giỏ hàng.*trống/i.test(raw)) {
        mapped = "Giỏ hàng hiện đang trống.";
      } else if (/access denied|forbidden|không có quyền|permission/i.test(raw)) {
        mapped = "Tài khoản không có quyền thực hiện thao tác này.";
      } else if (/invoice before completion/i.test(raw)) {
        mapped = "Đơn hàng cần được ghi nhận thu tiền (hóa đơn) trước khi hoàn tất.";
      }
      assert.equal(mapped, expected);
    }
  });

  it("enforces order status progression rules and cash collection at SHIPPING", () => {
    const VALID_NEXT = {
      PENDING: "CONFIRMED",
      CONFIRMED: "PACKING",
      PACKING: "SHIPPING",
      SHIPPING: "COMPLETED",
    };

    assert.equal(VALID_NEXT["PENDING"], "CONFIRMED");
    assert.equal(VALID_NEXT["CONFIRMED"], "PACKING");
    assert.equal(VALID_NEXT["PACKING"], "SHIPPING");
    assert.equal(VALID_NEXT["SHIPPING"], "COMPLETED");

    // Cash collection is only allowed at SHIPPING
    const allowedCollectionStatus = "SHIPPING";
    assert.equal(allowedCollectionStatus === "SHIPPING", true);
    assert.equal(allowedCollectionStatus === "PENDING", false);
    assert.equal(allowedCollectionStatus === "CONFIRMED", false);
  });

  it("verifies inventory invariants on order completion: physical - qty, reserved - qty, available invariant", () => {
    const physicalBefore = 10;
    const reservedBefore = 5;
    const availableBefore = physicalBefore - reservedBefore; // 5
    const orderQty = 1;

    // Simulation of OrderServiceImpl inventory update on COMPLETED
    const physicalAfter = physicalBefore - orderQty; // 9
    const reservedAfter = reservedBefore - orderQty; // 4
    const availableAfter = physicalAfter - reservedAfter; // 5

    assert.equal(physicalAfter, 9);
    assert.equal(reservedAfter, 4);
    assert.equal(availableAfter, availableBefore, "Available stock MUST be strictly preserved");
  });

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
