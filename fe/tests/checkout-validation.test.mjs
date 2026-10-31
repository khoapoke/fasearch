import assert from "node:assert/strict";
import test from "node:test";
import { checkoutBody } from "../src/lib/server/customer-commerce-validation.ts";

const valid = { deliveryAddress: "1 Main street, HCM", receiverName: "Synthetic", receiverPhone: "0900000000", paymentMethod: "COD", shippingFee: 15000 };
const fingerprint = "b".repeat(64);

test("checkout BFF whitelists legacy fields and never forwards browser financial totals", () => {
  const result = checkoutBody({ ...valid, totalAmount: 1, discountAmount: 999999, subTotal: 1, unitPrice: 0, pointsDiscount: 999999, availablePoints: 999999 });
  assert.deepEqual(result, { ok: true, body: valid });
});

test("voucher checkout requires exact quote confirmation and normalizes only the code", () => {
  const result = checkoutBody({ ...valid, voucherCode: " save10 ", quoteFingerprint: fingerprint, expectedMerchandiseAmountDue: 90000, checkoutKey: "attempt-1", totalAmount: 1 });
  assert.deepEqual(result, { ok: true, body: { ...valid, voucherCode: "SAVE10", quoteFingerprint: fingerprint, expectedMerchandiseAmountDue: 90000, checkoutKey: "attempt-1" } });
  assert.equal(checkoutBody({ ...valid, voucherCode: "SAVE10" }).ok, false);
  const withPoints = checkoutBody({ ...valid, redeemedPoints: 2, quoteFingerprint: fingerprint, expectedMerchandiseAmountDue: 70000, checkoutKey: "attempt-2", pointsDiscount: 999999 });
  assert.deepEqual(withPoints, { ok: true, body: { ...valid, redeemedPoints: 2, quoteFingerprint: fingerprint, expectedMerchandiseAmountDue: 70000, checkoutKey: "attempt-2" } });
});

test("malformed point requests, partial freshness fields, malformed fingerprints and oversized code are rejected", () => {
  assert.equal(checkoutBody({ ...valid, redeemedPoints: 1 }).ok, false);
  assert.equal(checkoutBody({ ...valid, redeemedPoints: 1.5 }).ok, false);
  assert.equal(checkoutBody({ ...valid, redeemedPoints: Number.MAX_SAFE_INTEGER + 1 }).ok, false);
  assert.equal(checkoutBody({ ...valid, quoteFingerprint: fingerprint }).ok, false);
  assert.equal(checkoutBody({ ...valid, quoteFingerprint: "A".repeat(64), expectedMerchandiseAmountDue: 1, checkoutKey: "attempt" }).ok, false);
  assert.equal(checkoutBody({ ...valid, voucherCode: "X".repeat(51), quoteFingerprint: fingerprint, expectedMerchandiseAmountDue: 1, checkoutKey: "attempt" }).ok, false);
});
