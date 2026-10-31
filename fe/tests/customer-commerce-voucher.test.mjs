import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCartQuote, normalizeCheckoutOrder, normalizeOrderDetail, normalizeOrderPage } from "../src/lib/customer-commerce.ts";
import { CommerceError } from "../src/lib/customer-commerce.ts";
import { createCustomerOrder, quoteCustomerCart } from "../src/lib/customer-commerce-client.ts";

const baseOrder = {
  orderId: 9, orderCode: "OD-9", status: "PENDING", customerName: "Synthetic", customerPhone: "0900000000",
  deliveryAddress: "HCM District 1", subTotal: 100000, discountAmount: 10000, shippingFee: 15000, totalAmount: 105000,
  voucherId: 4, voucherCode: "SAVE10", voucherCampaignName: "Summer", voucherCampaignVersion: 2, createdAt: "2026-10-30T20:00:00",
  customer: { customerId: 7, fullName: "Synthetic", phoneNumber: "0900000000" }, note: null,
  items: [{ skuId: 3, productName: "Tee", color: null, size: "M", imageUrl: null, quantity: 1, unitPrice: 100000, totalPrice: 100000, discountAmount: 10000 }],
};

// Sanitized shape and financial values observed for retained customer order 1.
const legacyVoucherIdOnlyOrder = {
  orderId: 1, orderCode: "LEGACY-1", status: "COMPLETED", customerName: null, customerPhone: null,
  deliveryAddress: null, subTotal: 300000, discountAmount: 0, shippingFee: 30000, totalAmount: 300000,
  voucherId: 1, voucherCode: null, voucherCampaignName: null, voucherCampaignVersion: null,
  replayed: false, createdAt: "2026-10-30T20:00:00", note: null, customer: null,
  items: [{ skuId: 1, productName: "Legacy item", color: null, size: null, imageUrl: null, quantity: 2, unitPrice: 150000, totalPrice: 300000, discountAmount: 0 }],
};

test("order detail preserves voucher identity and frozen SKU discount allocations", () => {
  const order = normalizeOrderDetail(baseOrder);
  assert.equal(order.voucherCode, "SAVE10");
  assert.equal(order.voucherCampaignVersion, 2);
  assert.equal(order.items[0].discountAmount, 10000);
});

test("legacy voucher-ID-only order remains readable without invented voucher metadata", () => {
  const list = normalizeOrderPage({ content: [legacyVoucherIdOnlyOrder], pageNumber: 2, pageSize: 10, totalElements: 25, totalPages: 3, last: true });
  assert.equal(list.items[0].voucherId, 1);
  assert.equal(list.items[0].voucherCode, null);
  assert.equal(list.items[0].voucherCampaignName, null);
  assert.equal(list.items[0].voucherCampaignVersion, null);

  const detail = normalizeOrderDetail(legacyVoucherIdOnlyOrder);
  assert.equal(detail.voucherId, 1);
  assert.equal(detail.voucherCode, null);
  assert.equal(detail.voucherCampaignName, null);
  assert.equal(detail.voucherCampaignVersion, null);
  assert.equal(detail.discountAmount, 0);
  assert.equal(detail.items[0].discountAmount, 0);
});

test("checkout with a requested voucher requires the matching complete persisted snapshot", async () => {
  const pendingLegacyShape = { ...legacyVoucherIdOnlyOrder, status: "PENDING" };
  assert.throws(() => normalizeCheckoutOrder(pendingLegacyShape, "SAVE10"), /định dạng/);
  assert.throws(() => normalizeCheckoutOrder({ ...baseOrder, voucherCode: "OTHER" }, "SAVE10"), /định dạng/);
  assert.equal(normalizeCheckoutOrder(baseOrder, " save10 ").voucherCampaignVersion, 2);

  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, result: pendingLegacyShape }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    await assert.rejects(createCustomerOrder({ deliveryAddress: "HCM", receiverName: "Synthetic", receiverPhone: "0900000000", paymentMethod: "COD", shippingFee: 0, voucherCode: "SAVE10", quoteFingerprint: "a".repeat(64), expectedMerchandiseAmountDue: 300000, checkoutKey: "checkout-test" }), (error) => error instanceof CommerceError && error.status === 502);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("legacy no-code order preserves supplied fields but rejects blank code and unknown discount", () => {
  const withLegacyFields = normalizeOrderDetail({ ...legacyVoucherIdOnlyOrder, voucherCampaignName: "Historical name", voucherCampaignVersion: 0 });
  assert.equal(withLegacyFields.voucherCampaignName, "Historical name");
  assert.equal(withLegacyFields.voucherCampaignVersion, 0);
  assert.throws(() => normalizeOrderDetail({ ...legacyVoucherIdOnlyOrder, voucherCode: "" }), /định dạng/);
  assert.throws(() => normalizeOrderDetail({ ...legacyVoucherIdOnlyOrder, discountAmount: undefined }), /định dạng/);
  assert.throws(() => normalizeOrderDetail({ ...legacyVoucherIdOnlyOrder, voucherCampaignVersion: -1 }), /định dạng/);
});

test("voucher-backed order rejects missing historical discount snapshots", () => {
  assert.throws(() => normalizeOrderDetail({ ...baseOrder, discountAmount: undefined }), /định dạng/);
  assert.throws(() => normalizeOrderDetail({ ...baseOrder, items: [{ ...baseOrder.items[0], discountAmount: undefined }] }), /định dạng/);
});

test("cart quote requires complete S2 loyalty fields, consistent server totals and an opaque fingerprint", () => {
  const raw = {
    items: [{ skuId: 3, productName: "Tee", quantity: 1, unitPrice: 100000, totalPrice: 100000, discountAmount: 10000, pointsDiscountAmount: 0 }],
    subTotal: 100000, voucherCode: "SAVE10", voucherDiscount: 10000, remainingMerchandiseAmount: 90000,
    redeemedPoints: 0, pointsDiscount: 0, allowedRedeemedPoints: 0, availablePoints: null, policyStatus: "UNCONFIGURED",
    loyaltyPolicyId: null, loyaltyPolicyVersion: null, redeemCurrencyPerPoint: null, merchandiseAmountDue: 90000,
    quoteFingerprint: "a".repeat(64),
  };
  const valid = normalizeCartQuote(raw);
  assert.equal(valid.merchandiseAmountDue, 90000);
  assert.equal(valid.availablePoints, null);
  assert.equal(valid.policyStatus, "UNCONFIGURED");
  assert.throws(() => normalizeCartQuote({ ...raw, quoteFingerprint: "ABC" }), /định dạng/);
  assert.throws(() => normalizeCartQuote({ ...raw, merchandiseAmountDue: 0 }), /định dạng/);
  assert.throws(() => normalizeCartQuote({ ...raw, pointsDiscount: 1 }), /định dạng/);
});

test("customer commerce surfaces the v1.4 business code and field reason from a quote error", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: false, code: 4204, message: "Điểm vượt quá giới hạn.", result: null,
    errors: [{ field: "redeemedPoints", reason: "Allowed maximum: 4" }],
  }), { status: 409, headers: { "content-type": "application/json" } });
  try {
    await assert.rejects(quoteCustomerCart(null, 5), (error) => {
      assert.ok(error instanceof CommerceError);
      assert.equal(error.status, 409);
      assert.equal(error.code, "4204");
      assert.match(error.message, /Allowed maximum: 4/);
      return true;
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});
