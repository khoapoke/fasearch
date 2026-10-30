import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCartQuote, normalizeOrderDetail } from "../src/lib/customer-commerce.ts";

const baseOrder = {
  orderId: 9, orderCode: "OD-9", status: "PENDING", customerName: "Synthetic", customerPhone: "0900000000",
  deliveryAddress: "HCM District 1", subTotal: 100000, discountAmount: 10000, shippingFee: 15000, totalAmount: 105000,
  voucherId: 4, voucherCode: "SAVE10", voucherCampaignName: "Summer", voucherCampaignVersion: 2, createdAt: "2026-10-30T20:00:00",
  customer: { customerId: 7, fullName: "Synthetic", phoneNumber: "0900000000" }, note: null,
  items: [{ skuId: 3, productName: "Tee", color: null, size: "M", imageUrl: null, quantity: 1, unitPrice: 100000, totalPrice: 100000, discountAmount: 10000 }],
};

test("order detail preserves voucher identity and frozen SKU discount allocations", () => {
  const order = normalizeOrderDetail(baseOrder);
  assert.equal(order.voucherCode, "SAVE10");
  assert.equal(order.voucherCampaignVersion, 2);
  assert.equal(order.items[0].discountAmount, 10000);
});

test("voucher-backed order rejects missing historical discount snapshots", () => {
  assert.throws(() => normalizeOrderDetail({ ...baseOrder, discountAmount: undefined }), /định dạng/);
  assert.throws(() => normalizeOrderDetail({ ...baseOrder, items: [{ ...baseOrder.items[0], discountAmount: undefined }] }), /định dạng/);
});

test("cart quote requires an opaque lowercase SHA-256 fingerprint and server line discounts", () => {
  const valid = normalizeCartQuote({ items: [{ skuId: 3, productName: "Tee", quantity: 1, unitPrice: 100000, totalPrice: 100000, discountAmount: 10000 }], subTotal: 100000, voucherCode: "SAVE10", voucherDiscount: 10000, merchandiseAmountDue: 90000, quoteFingerprint: "a".repeat(64) });
  assert.equal(valid.merchandiseAmountDue, 90000);
  assert.throws(() => normalizeCartQuote({ ...valid, quoteFingerprint: "ABC" }), /định dạng/);
});
