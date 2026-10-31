// The POS payment response is an InvoiceRes; line allocations come from the order-detail route.
import assert from "node:assert/strict";
import test from "node:test";
import { normalizePosReceipt } from "../src/lib/pos-client.ts";

const invoice = {
  invoiceId: 10, orderId: 14, totalActualPaid: 150000, cashChange: 50000,
  redeemedPoints: 3, pointsDiscount: 3000, earnedPoints: 2,
  loyaltyPolicyId: 4, loyaltyPolicyVersion: 2, redeemCurrencyPerPointSnapshot: 1000,
};
const order = {
  orderId: 14, totalAmount: 150000, discountAmount: 30000, voucherId: 5,
  redeemedPoints: 3, pointsDiscount: 3000, earnedPoints: 2,
  loyaltyPolicyId: 4, loyaltyPolicyVersion: 2, redeemCurrencyPerPointSnapshot: 1000,
  items: [{ skuId: 2, productName: "Áo", quantity: 1, totalPrice: 150000, discountAmount: 30000, pointsDiscountAmount: 3000 }],
};

test("joins the contract invoice with its order snapshot and preserves voucher/points allocations", () => {
  const receipt = normalizePosReceipt(invoice, order);
  assert.equal(receipt.maDonHang, 14);
  assert.equal(receipt.maHoaDon, 10);
  assert.equal(receipt.tienThua, 50000);
  assert.equal(receipt.giamVoucher, 30000);
  assert.equal(receipt.giamDiem, 3000);
  assert.equal(receipt.earnedPoints, 2);
  assert.equal(receipt.loyaltyPolicyId, 4);
  assert.deepEqual(receipt.items, [{ maSku: 2, tenSpSnapshot: "Áo", soLuong: 1, tongDong: 150000, tienGiamGia: 30000, diemGiam: 3000 }]);
});

test("rejects an invoice/order mismatch and incomplete line snapshots", () => {
  assert.throws(() => normalizePosReceipt({ ...invoice, orderId: 15 }, order), /không khớp đơn hàng/);
  assert.throws(() => normalizePosReceipt(invoice, { ...order, items: undefined }), /không khớp đơn hàng/);
  assert.throws(() => normalizePosReceipt({ ...invoice, pointsDiscount: 1 }, order), /không khớp đơn/);
  assert.throws(() => normalizePosReceipt({ ...invoice, earnedPoints: 3 }, order), /không khớp đơn/);
  assert.throws(() => normalizePosReceipt(invoice, { ...order, items: [{ ...order.items[0], pointsDiscountAmount: null }] }), /Phân bổ điểm/);
});

test("legacy cash receipt without an S2 loyalty snapshot remains readable", () => {
  const receipt = normalizePosReceipt(
    { invoiceId: 11, orderId: 14, totalActualPaid: 150000, cashChange: 0 },
    { orderId: 14, totalAmount: 150000, discountAmount: 0, items: [{ skuId: 2, productName: "Áo", quantity: 1, totalPrice: 150000, discountAmount: 0 }] },
  );
  assert.equal(receipt.earnedPoints, null);
  assert.equal(receipt.diemSuDung, null);
});
