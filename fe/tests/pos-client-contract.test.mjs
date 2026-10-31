import assert from "node:assert/strict";
import test from "node:test";
import { CommerceError } from "../src/lib/customer-commerce.ts";
import { posCreateDraft, posFindCustomer, posPay, posQuote, posSearchProducts } from "../src/lib/pos-client.ts";

const fingerprint = "a".repeat(64);
const envelope = (result) => ({ success: true, code: 200, message: "ok", result });

function mockFetch(handler) {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  return () => { globalThis.fetch = real; };
}

test("POS draft uses contract-native customerPhone and SKU lines", async () => {
  const calls = [];
  const restore = mockFetch(async (url, init) => {
    calls.push({ url: String(url), method: init.method, body: init.body });
    return new Response(JSON.stringify(envelope({
      orderId: 15, status: "DRAFT", customer: { customerId: 7, fullName: "Test", phoneNumber: "0901234567" },
      items: [{ skuId: 3, productName: "Áo", quantity: 2, unitPrice: 50000 }],
    })), { status: 201 });
  });
  try {
    const draft = await posCreateDraft({ customerPhone: "0901234567", items: [{ maSku: 3, soLuong: 2 }] });
    assert.equal(draft.maDonHang, 15);
    assert.equal(draft.customerName, "Test");
    assert.match(calls[0].url, /\/api\/staff\/pos\/drafts$/);
    assert.deepEqual(JSON.parse(calls[0].body), { customerPhone: "0901234567", items: [{ skuId: 3, quantity: 2 }] });
  } finally { restore(); }
});

test("POS quote uses the v1.4 endpoint, business fields, and exact fingerprint", async () => {
  const calls = [];
  const restore = mockFetch(async (url, init) => {
    calls.push({ url: String(url), method: init.method, body: init.body });
    return new Response(JSON.stringify(envelope({
      orderId: 15, items: [{ skuId: 3, productName: "Áo", quantity: 2, unitPrice: 100000, totalPrice: 200000, discountAmount: 20000, pointsDiscountAmount: 2000 }],
      subTotal: 200000, voucherCode: "SAVE10", voucherDiscount: 20000,
      remainingMerchandiseAmount: 180000, redeemedPoints: 2, pointsDiscount: 2000,
      allowedRedeemedPoints: 10, availablePoints: 15, policyStatus: "ENABLED",
      loyaltyPolicyId: 4, loyaltyPolicyVersion: 2, redeemCurrencyPerPoint: 1000,
      merchandiseAmountDue: 178000, quoteFingerprint: fingerprint,
    })), { status: 200 });
  });
  try {
    const quote = await posQuote(15, { voucherCode: "SAVE10", diemSuDung: 2 });
    assert.equal(quote.tongThanhToan, 178000);
    assert.equal(quote.diemDuocPhep, 10);
    assert.equal(quote.quoteFingerprint, fingerprint);
    assert.equal(quote.items[0].pointsDiscountAmount, 2000);
    assert.equal(quote.redeemCurrencyPerPoint, 1000);
    assert.match(calls[0].url, /\/api\/staff\/pos\/orders\/15\/quote$/);
    assert.deepEqual(JSON.parse(calls[0].body), { voucherCode: "SAVE10", redeemedPoints: 2 });
  } finally { restore(); }
});

test("POS quote rejects a mismatched order id or inconsistent contract totals", async () => {
  const invalidQuotes = [
    { orderId: 16, items: [], subTotal: 200000, voucherCode: "SAVE10", voucherDiscount: 20000, remainingMerchandiseAmount: 180000, redeemedPoints: 2, pointsDiscount: 2000, allowedRedeemedPoints: 10, availablePoints: 15, policyStatus: "ENABLED", loyaltyPolicyId: 4, loyaltyPolicyVersion: 2, redeemCurrencyPerPoint: 1000, merchandiseAmountDue: 178000, quoteFingerprint: fingerprint },
    { orderId: 15, items: [], subTotal: 200000, voucherCode: "SAVE10", voucherDiscount: 20000, remainingMerchandiseAmount: 180000, redeemedPoints: 2, pointsDiscount: 2000, allowedRedeemedPoints: 10, availablePoints: 15, policyStatus: "ENABLED", loyaltyPolicyId: 4, loyaltyPolicyVersion: 2, redeemCurrencyPerPoint: 1000, merchandiseAmountDue: 0, quoteFingerprint: fingerprint },
  ];
  const restore = mockFetch(async () => new Response(JSON.stringify(envelope(invalidQuotes.shift())), { status: 200 }));
  try {
    await assert.rejects(posQuote(15), (error) => error instanceof CommerceError && error.status === 502);
    await assert.rejects(posQuote(15), (error) => error instanceof CommerceError && error.status === 502);
  } finally { restore(); }
});

test("POS pay sends quote fingerprint then joins the invoice to the persisted order snapshot", async () => {
  const calls = [];
  const restore = mockFetch(async (url, init) => {
    calls.push({ url: String(url), method: init.method, body: init.body });
    const result = init.method === "POST"
      ? { invoiceId: 9, orderId: 15, totalActualPaid: 178000, cashReceived: 200000, cashChange: 22000, redeemedPoints: 2, pointsDiscount: 2000, earnedPoints: 4, loyaltyPolicyId: 4, loyaltyPolicyVersion: 2, redeemCurrencyPerPointSnapshot: 1000 }
      : { orderId: 15, totalAmount: 178000, discountAmount: 20000, voucherId: 3, redeemedPoints: 2, pointsDiscount: 2000, earnedPoints: 4, loyaltyPolicyId: 4, loyaltyPolicyVersion: 2, redeemCurrencyPerPointSnapshot: 1000, items: [{ skuId: 3, productName: "Áo", quantity: 2, totalPrice: 200000, discountAmount: 20000, pointsDiscountAmount: 2000 }] };
    return new Response(JSON.stringify(envelope(result)), { status: 200 });
  });
  try {
    const receipt = await posPay(15, { amountPaid: 200000, quoteFingerprint: fingerprint, voucherCode: "SAVE10", redeemedPoints: 2 });
    assert.equal(receipt.maHoaDon, 9);
    assert.equal(receipt.maDonHang, 15);
    assert.equal(receipt.tienThua, 22000);
    assert.equal(receipt.earnedPoints, 4);
    assert.match(calls[0].url, /\/api\/staff\/pos\/payments\/process$/);
    assert.deepEqual(JSON.parse(calls[0].body), {
      orderId: 15, paymentMethodCode: "CASH", amountPaid: 200000,
      voucherCode: "SAVE10", redeemedPoints: 2, quoteFingerprint: fingerprint,
    });
    assert.match(calls[1].url, /\/api\/staff\/pos\/orders\/15$/);
  } finally { restore(); }
});

test("POS searches map actual product/customer API fields without accepting a phone substring", async () => {
  const restore = mockFetch(async (url) => {
    if (String(url).includes("products")) return new Response(JSON.stringify(envelope([{ skuId: 2, productId: 1, productName: "Áo", price: 50000, availableStock: 4 }])), { status: 200 });
    return new Response(JSON.stringify(envelope({ content: [
      { id: 4, firstName: "Lê", lastName: "An", phoneNumber: "0901234567", accumulatePoint: 12 },
      { id: 5, firstName: "Lê", lastName: "Bình", phoneNumber: "09012345678" },
    ] })), { status: 200 });
  });
  try {
    const products = await posSearchProducts("áo");
    assert.equal(products.data[0].maSku, 2);
    assert.equal(products.data[0].soLuongKhaDung, 4);
    const customer = await posFindCustomer("0901234567");
    assert.equal(customer.maKh, 4);
    assert.equal(customer.hoTen, "Lê An");
  } finally { restore(); }
});
