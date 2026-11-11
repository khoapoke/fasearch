import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutBody } from '../src/lib/server/customer-commerce-validation.ts';
import { campaignBody } from '../src/lib/server/promotions-validation.ts';
import { normalizeShipping } from '../src/lib/customer-commerce.ts';
import { offerDiscountLabel } from '../src/lib/offers.ts';
const checkout = { deliveryAddress: '140 Le Trong Tan', receiverName: 'Shipping test', receiverPhone: '0901234567', paymentMethod: 'COD', shippingFee: 15000 };
test('delivery coordinates survive the checkout BFF whitelist', () => {
  const input = { ...checkout, deliveryLatitude: 10.8070354, deliveryLongitude: 106.6287031 };
  assert.deepEqual(checkoutBody(input), { ok: true, body: input });
});
test('invalid coordinate pairs cannot enter checkout', () => {
  for (const pair of [{ deliveryLatitude: 10 }, { deliveryLongitude: 106 }, { deliveryLatitude: NaN, deliveryLongitude: 106 }, { deliveryLatitude: 91, deliveryLongitude: 106 }, { deliveryLatitude: 10, deliveryLongitude: 181 }, { deliveryLatitude: null, deliveryLongitude: null }]) assert.equal(checkoutBody({ ...checkout, ...pair }).ok, false);
});
test('zero latitude and longitude are valid coordinates', () => {
  assert.equal(checkoutBody({ ...checkout, deliveryLatitude: 0, deliveryLongitude: 0 }).ok, true);
});
test('shipping response retains quote breakdown and route method', () => {
  const raw = { shippingFee: 0, estimatedDays: '1 - 3 ngày', distanceKm: 12.345, method: 'estimate', baseFee: 35000, shippingDiscount: 35000 };
  assert.deepEqual(normalizeShipping(raw), raw);
  assert.throws(() => normalizeShipping({ ...raw, distanceKm: -1 }));
});
test('legacy shipping response still normalizes', () => {
  assert.equal(normalizeShipping({ shippingFee: 25000 }).shippingFee, 25000);
  assert.equal(normalizeShipping({ shippingFee: 25000 }).method, 'flat');
});
test('free-ship campaigns pass create and edit validation and display as free shipping', () => {
  const create = { tenCtkm: 'Free shipping', loaiGiam: 'FREE_SHIP', giaTriGiam: 1, ngayBatDau: '2026-11-05T00:00:00', ngayKetThuc: '2026-11-30T23:59:59' };
  assert.equal(campaignBody(create, true)?.loaiGiam, 'FREE_SHIP');
  assert.equal(campaignBody({ phienBan: 0, loaiGiam: 'FREE_SHIP', giaTriGiam: 1 }, false)?.loaiGiam, 'FREE_SHIP');
  assert.equal(offerDiscountLabel({ discountType: 'FREE_SHIP', discountValue: 1 }), 'Miễn phí giao hàng');
});
