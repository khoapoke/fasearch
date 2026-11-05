// Shared commerce helpers (COD checkout / stock lookup) used by the write suites. Clone DB only.
import { randomUUID } from "node:crypto";
import { res } from "./http.mjs";

export async function stockOf(admin, sku) {
  const r = res((await admin.req("GET", `/api/admin/stock/${sku}`)).j) ?? {};
  return [r.physicalStock, r.reservedStock, r.availableStock];
}

export async function checkout(c, sku, qty, { voucher, note = "e2e" } = {}) {
  await c.req("POST", "/api/customer-commerce/cart/items", { body: { skuId: sku, quantity: qty } });
  const q = await c.req("POST", "/api/customer-commerce/cart/quote", { body: { voucherCode: voucher ?? null, redeemedPoints: 0 } });
  const body = { deliveryAddress: "14 Demo Street, Quan 1, TP HCM", receiverName: "E2E Demo", receiverPhone: "0913000001", paymentMethod: "COD", shippingFee: 0, note };
  if (voucher) { const qr = res(q.j); Object.assign(body, { voucherCode: voucher, quoteFingerprint: qr.quoteFingerprint, expectedMerchandiseAmountDue: qr.merchandiseAmountDue, checkoutKey: randomUUID().replace(/-/g, "") }); }
  return { q, o: await c.req("POST", "/api/customer-commerce/orders", { body }) };
}
