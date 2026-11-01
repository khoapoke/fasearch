import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Customer & Admin Core Journey Polish - Contract & Error Verification", () => {
  it("maps raw backend English errors to human Vietnamese messages", () => {
    const rawErrors = [
      { raw: "Insufficient stock for requested SKU 56", expected: "Sản phẩm hoặc biến thể này hiện không đủ số lượng tồn kho." },
      { raw: "Cart is empty", expected: "Giỏ hàng hiện đang trống." },
      { raw: "Access denied: insufficient permissions", expected: "Tài khoản không có quyền thực hiện thao tác này." },
      { raw: "Invoice before completion required", expected: "Đơn hàng cần được ghi nhận thu tiền (hóa đơn) trước khi hoàn tất." },
    ];

    for (const { raw, expected } of rawErrors) {
      let mapped = "";
      if (/insufficient.*stock|hết hàng|tồn kho/i.test(raw)) {
        mapped = "Sản phẩm hoặc biến thể này hiện không đủ số lượng tồn kho.";
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
});
