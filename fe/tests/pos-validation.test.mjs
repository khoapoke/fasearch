import assert from "node:assert/strict";
import test from "node:test";
import { posDraftBody, posPaymentBody, posQuoteBody } from "../src/lib/server/pos-validation.ts";

const fingerprint = "a".repeat(64);

test("POS draft accepts only a bounded customer and unique valid SKU lines", () => {
  assert.deepEqual(posDraftBody({ customerPhone: "0901234567", items: [{ skuId: 7, quantity: 2 }], ignored: 123 }), {
    customerPhone: "0901234567", items: [{ skuId: 7, quantity: 2 }],
  });
  assert.equal(posDraftBody({ items: [] }), null);
  assert.equal(posDraftBody({ items: [{ skuId: 7, quantity: 1 }, { skuId: 7, quantity: 2 }] }), null);
  assert.equal(posDraftBody({ customerPhone: "+84901234567", items: [{ skuId: 7, quantity: 1 }] }), null);
});

test("POS quote canonicalizes a voucher and bounds integer points", () => {
  assert.deepEqual(posQuoteBody({ voucherCode: " save10 ", redeemedPoints: 3 }), { voucherCode: "SAVE10", redeemedPoints: 3 });
  assert.equal(posQuoteBody({ redeemedPoints: -1 }), null);
  assert.equal(posQuoteBody({ voucherCode: "BAD CODE" }), null);
});

test("POS payment keeps server-authoritative benefits and refuses stale/malformed fingerprints", () => {
  assert.deepEqual(posPaymentBody({
    orderId: 9, paymentMethodCode: "CASH", amountPaid: 120000, voucherCode: "save10",
    redeemedPoints: 3, quoteFingerprint: fingerprint, expectedTotal: 1,
  }), {
    orderId: 9, paymentMethodCode: "CASH", amountPaid: 120000, voucherCode: "SAVE10",
    redeemedPoints: 3, quoteFingerprint: fingerprint,
  });
  assert.equal(posPaymentBody({ orderId: 9, paymentMethodCode: "CASH", amountPaid: 120000, redeemedPoints: 3 }), null);
  assert.equal(posPaymentBody({ orderId: 9, paymentMethodCode: "CARD", amountPaid: 120000 }), null);
  assert.equal(posPaymentBody({ orderId: 9, paymentMethodCode: "CASH", amountPaid: 120000.5 }), null);
});
