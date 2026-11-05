// [customer+admin:write] End-to-end commerce lifecycle on a CLONE database:
//   admin import -> customer profile/favorites/history/cart -> COD checkout (voucher) + customer cancel
//   -> COD order walked to COMPLETED with cash collection -> stock / loyalty / report consistency
//   -> admin cancel, draft/category/loyalty-policy writes -> logout guards.
// Ported from demo-rehearsal/rehearse.py (admin_stage1, customer, admin_stage2, customer_end).
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { suite } from "../lib/suite.mjs";
import { Client } from "../lib/http.mjs";
import { requireCreds } from "../lib/fixtures.mjs";
import { discoverSkus, discoverProduct } from "../lib/data.mjs";
import { checkout, stockOf } from "../lib/commerce.mjs";
import { step, chk, pageChk, res, daysAgo, today } from "../lib/steps.mjs";

suite(["customer", "admin"], "commerce lifecycle (customer + admin)", () => {
  test("lifecycle", { timeout: 900000 }, async (t) => {
    const a = new Client(), c = new Client();
    const af = requireCreds("ADMIN"), cf = requireCreds("CUSTOMER");
    await chk(t, "A-auth Admin login", await a.login(af.username, af.password), { pred: (j) => j.identity.role === "ADMIN" });
    const [S1, S2] = await discoverSkus(a); const pid = await discoverProduct(new Client());
    const ctx = {};

    // ---- admin: import (multi-line) raises stock
    const s1b = await stockOf(a, S1), s2b = await stockOf(a, S2);
    const imp = await a.req("POST", "/api/admin/imports", { body: { supplierName: "E2E NCC", note: "e2e multi-line", items: [{ skuId: S1, quantity: 6, importPrice: 100000 }, { skuId: S2, quantity: 6, importPrice: 90000 }] } });
    const ji = await chk(t, "A-imp Import receipt 2 lines", imp, { ok: [200, 201], pred: (j) => res(j).totalQuantity === 12 && res(j).status === "COMPLETED" });
    const s1a = await stockOf(a, S1), s2a = await stockOf(a, S2);
    await step(t, "A-imp Import raises physical stock +6 each", () => assert.ok(s1a[0] === (s1b[0] ?? 0) + 6 && s2a[0] === (s2b[0] ?? 0) + 6, `${s1b}->${s1a}; ${s2b}->${s2a}`));
    const rid = res(ji)?.receiptId;
    if (rid) { await chk(t, "A-imp Import receipt detail", await a.req("GET", `/api/admin/imports/${rid}`), { pred: (j) => res(j).items.length === 2 }); await pageChk(t, "A-imp Import detail page", a, `/quan-tri/phieu-nhap/${rid}`); }
    await chk(t, "A-imp Import duplicate SKU rejected", await a.req("POST", "/api/admin/imports", { body: { supplierName: "x", items: [{ skuId: S1, quantity: 1, importPrice: 1 }, { skuId: S1, quantity: 1, importPrice: 1 }] } }), { ok: [400] });

    // ---- customer: session, profile, favorites, history, cart
    await chk(t, "C-auth Customer login", await c.login(cf.username, cf.password), { pred: (j) => j.identity.role === "CUSTOMER" });
    const orig = res((await c.req("GET", "/api/customer-profile")).j); const oa = orig?.address ?? "";
    await chk(t, "C-prof Profile edit address", await c.req("PATCH", "/api/customer-profile", { body: { address: "E2E edit 99 Test St" } }));
    await chk(t, "C-prof Profile reflects edit", await c.req("GET", "/api/customer-profile"), { pred: (j) => res(j).address === "E2E edit 99 Test St" });
    await chk(t, "C-prof Profile restore", await c.req("PATCH", "/api/customer-profile", { body: { address: oa } }));
    await chk(t, "C-prof Profile restored value equal", await c.req("GET", "/api/customer-profile"), { pred: (j) => (res(j).address ?? "") === oa });
    await chk(t, `C-fav Favorite add (${pid})`, await c.req("POST", `/api/customer-account/favorites?productId=${pid}`, { body: {} }), { ok: [200, 201] });
    await chk(t, "C-fav Favorite listed", await c.req("GET", "/api/customer-account/favorites"), { pred: (j) => res(j).content.some((x) => [x.productId, x.id, x.product?.id].includes(pid)) });
    await chk(t, "C-fav Favorite remove", await c.req("DELETE", `/api/customer-account/favorites?productId=${pid}`), { ok: [200, 204] });
    await chk(t, "C-fav Favorite gone", await c.req("GET", "/api/customer-account/favorites"), { pred: (j) => !res(j).content.some((x) => [x.productId, x.id, x.product?.id].includes(pid)) });
    await chk(t, "C-hist Search history POST", await c.req("POST", "/api/customer-account/search-history", { body: { mode: "TEXT", query: "e2e áo khoác", resultCount: 5, status: "SUCCESS" } }), { ok: [200, 201] });
    const hl = await c.req("GET", "/api/customer-account/search-history");
    await chk(t, "C-hist Search history list", hl, { pred: (j) => res(j).content.length >= 1 });
    for (const x of res(hl.j)?.content ?? []) { const i = x.id ?? x.historyId; if (i && String(x.query ?? "").startsWith("e2e")) await c.req("DELETE", `/api/customer-account/search-history?id=${i}`); }
    await chk(t, "C-cart Cart add", await c.req("POST", "/api/customer-commerce/cart/items", { body: { skuId: S1, quantity: 1 } }));
    await chk(t, "C-cart Cart update qty=2", await c.req("PUT", `/api/customer-commerce/cart/items/${S1}`, { body: { quantity: 2 } }), { pred: (j) => res(j).totalItems === 2 });
    await chk(t, "C-cart Cart remove", await c.req("DELETE", `/api/customer-commerce/cart/items/${S1}`, { body: {} }), { pred: (j) => res(j).totalItems === 0 });

    // ---- order B: voucher + customer cancel
    const offers = res((await c.req("GET", "/api/customer-commerce/offers")).j) ?? [];
    await step(t, "C-vou Published offer exists", () => assert.ok(offers.length > 0, "none"));
    const voucher = offers[0]?.code; const S0 = await stockOf(a, S2);
    const { q: qB, o: oB } = await checkout(c, S2, 1, { voucher, note: "e2e B voucher cancel" });
    if (voucher) await chk(t, "C-vou Quote with voucher applies discount", qB, { pred: (j) => res(j).merchandiseAmountDue < res(j).items[0].totalPrice });
    const ob = res(await chk(t, "C-ord COD checkout w/ voucher (order B)", oB, { ok: [200, 201] })) ?? {};
    ctx.B = ob.orderId;
    if (ob.orderId) {
      await step(t, "C-ord Order B voucher recorded", () => assert.equal(ob.voucherCode, voucher));
      const sr = await stockOf(a, S2); await step(t, "C-stk Stock reserved after checkout (reserved+1)", () => assert.equal(sr[1], (S0[1] ?? 0) + 1, `${S0}->${sr}`));
      await chk(t, "C-ord Order B in customer list", await c.req("GET", "/api/customer-commerce/orders?size=5"), { pred: (j) => res(j).content.some((x) => x.orderId === ob.orderId) });
      await pageChk(t, "C-ord Order B detail page", c, `/don-hang/${ob.orderId}`);
      await chk(t, "C-ord Order B detail API", await c.req("GET", `/api/customer-commerce/orders/${ob.orderId}`), { pred: (j) => res(j).status === "PENDING" });
      await chk(t, "C-ord Customer cancels order B", await c.req("POST", `/api/customer-commerce/orders/${ob.orderId}/cancel`, { body: { reason: "e2e doi y" } }));
      await chk(t, "C-ord Order B now CANCELLED", await c.req("GET", `/api/customer-commerce/orders/${ob.orderId}`), { pred: (j) => res(j).status === "CANCELLED" });
      const s1 = await stockOf(a, S2); await step(t, "C-stk Stock released after customer cancel", () => assert.deepEqual(s1, S0));
    }
    // ---- order A (completion) and C (admin cancel)
    const pts0 = res((await c.req("GET", "/api/customer-commerce/loyalty")).j);
    const { o: oA } = await checkout(c, S1, 1, { note: "e2e A complete" });
    const oa_ = res(await chk(t, "C-ord COD checkout (order A)", oA, { ok: [200, 201] })) ?? {}; ctx.A = oa_.orderId; ctx.totalA = oa_.totalAmount;
    const { o: oC } = await checkout(c, S2, 1, { note: "e2e C admin cancel" });
    ctx.C = res(await chk(t, "C-ord COD checkout (order C)", oC, { ok: [200, 201] }))?.orderId;
    await chk(t, "C-loy Loyalty summary", await c.req("GET", "/api/customer-commerce/loyalty"), { pred: (j) => "balancePoints" in res(j) });

    // ---- admin: order A to COMPLETED
    const A = ctx.A, B = ctx.B, C = ctx.C;
    const stA0 = await stockOf(a, S1); // after checkout: order A is PENDING and its quantity is reserved
    await chk(t, "A-ord Order A visible in admin detail", await a.req("GET", `/api/admin/orders/${A}`), { pred: (j) => res(j).status === "PENDING" });
    await pageChk(t, "A-ord Admin order detail page", a, `/quan-tri/don-hang/${A}`);
    for (const s of ["CONFIRMED", "PACKING", "SHIPPING"]) await chk(t, `A-ord Order A -> ${s}`, await a.req("PATCH", `/api/admin/orders/${A}/status`, { body: { status: s } }));
    await chk(t, "A-ord Order A cash collection", await a.req("POST", `/api/admin/orders/${A}/cash-collection`, { body: { amountPaid: ctx.totalA, note: "e2e thu tien" } }), { ok: [200, 201] });
    await chk(t, "A-ord Order A -> COMPLETED", await a.req("PATCH", `/api/admin/orders/${A}/status`, { body: { status: "COMPLETED" } }));
    const d = res((await a.req("GET", `/api/admin/orders/${A}`)).j) ?? {};
    await step(t, "A-cons Order A final status COMPLETED", () => assert.equal(d.status, "COMPLETED"));
    const stA1 = await stockOf(a, S1);
    await step(t, "A-cons Stock: physical-1 and reserved back after completion", () => assert.ok(stA1[0] === (stA0[0] ?? 0) - 1 && stA1[1] === (stA0[1] ?? 0) - 1, `${stA0}->${stA1}`));
    await step(t, "A-cons earnedPoints set on completed order", () => assert.ok((d.earnedPoints ?? 0) > 0, `earned=${d.earnedPoints}`));
    const c2 = new Client(); await c2.login(cf.username, cf.password);
    const l1 = res((await c2.req("GET", "/api/customer-commerce/loyalty")).j) ?? {};
    await step(t, "A-cons Customer points +earned & paid sales +total", () => assert.ok((l1.balancePoints - pts0.balancePoints) === d.earnedPoints && Math.abs((l1.cumulativePaidSales - pts0.cumulativePaidSales) - ctx.totalA) < 1, `pts ${pts0.balancePoints}->${l1.balancePoints}`));
    await chk(t, "A-cons Customer sees COMPLETED", await c2.req("GET", `/api/customer-commerce/orders/${A}`), { pred: (j) => res(j).status === "COMPLETED" });
    await chk(t, "A-rep Revenue report (today)", await a.req("GET", `/api/admin/reports/revenue?period=DAY&startDate=${today()}&endDate=${today()}`), { pred: (j) => res(j) != null });
    await chk(t, "A-rep Revenue report (7 days)", await a.req("GET", `/api/admin/reports/revenue?period=DAY&startDate=${daysAgo(7)}&endDate=${today()}`));
    await chk(t, "A-rep Top products", await a.req("GET", `/api/admin/reports/top-products?startDate=${daysAgo(30)}&endDate=${today()}`), { pred: (j) => res(j).length > 0 });
    // ---- admin cancel order C
    const sc0 = await stockOf(a, S2);
    await chk(t, "A-can Order C -> CONFIRMED", await a.req("PATCH", `/api/admin/orders/${C}/status`, { body: { status: "CONFIRMED" } }));
    await chk(t, "A-can Admin cancels order C", await a.req("POST", `/api/admin/orders/${C}/cancel`, { body: { reason: "e2e admin huy" } }));
    await chk(t, "A-can Order C CANCELLED", await a.req("GET", `/api/admin/orders/${C}`), { pred: (j) => res(j).status === "CANCELLED" });
    const sc1 = await stockOf(a, S2); await step(t, "A-can Stock reserved released after admin cancel", () => assert.equal(sc1[1], (sc0[1] ?? 0) - 1, `${sc0}->${sc1}`));
    await chk(t, "A-can Completed order cannot be cancelled", await a.req("POST", `/api/admin/orders/${A}/cancel`, { body: { reason: "x" } }), { ok: [400, 409, 422] });
    // ---- catalog / categories / loyalty writes
    const pr = res((await a.req("GET", `/api/admin/catalog/products/${pid}`)).j); const p0 = pr.price;
    await chk(t, "A-prd Direct PATCH of published product refused (409; edits go via draft)", await a.req("PATCH", `/api/admin/catalog/products/${pid}`, { body: { price: p0 + 1000 } }), { ok: [409] });
    const jd = await chk(t, "A-prd Edit published product: open draft", await a.req("POST", "/api/admin/catalog/drafts", { body: { productId: pid, productName: pr.productName, categoryId: pr.categoryId, price: p0 + 1000 } }), { ok: [200, 201] });
    const dd = res(jd) ?? {}; const did = dd.id ?? dd.draftId;
    if (did) {
      await chk(t, "A-prd Edit draft: change price", await a.req("PUT", `/api/admin/catalog/drafts/${did}`, { body: { expectedVersion: dd.version ?? 1, price: p0 + 2000 } }));
      await chk(t, "A-prd Storefront price unchanged while draft open", await a.req("GET", `/api/catalog/products/${pid}`), { pred: (j) => res(j).price === p0 });
      await chk(t, "A-prd Discard draft", await a.req("DELETE", `/api/admin/catalog/drafts/${did}`), { ok: [200, 204] });
    }
    await chk(t, "A-prd Storefront price still original", await a.req("GET", `/api/catalog/products/${pid}`), { pred: (j) => res(j).price === p0 });
    const nm = "E2E " + randomUUID().slice(0, 6);
    const cid = res(await chk(t, "A-cat Category create", await a.req("POST", "/api/admin/catalog/categories", { body: { categoryName: nm } }), { ok: [200, 201] }))?.id;
    if (cid) { await chk(t, "A-cat Category rename", await a.req("PATCH", `/api/admin/catalog/categories/${cid}`, { body: { categoryName: nm + " v2" } })); await chk(t, "A-cat Category delete", await a.req("DELETE", `/api/admin/catalog/categories/${cid}`), { ok: [200, 204] }); }
    const pol = res((await a.req("GET", "/api/admin/loyalty/policies")).j)?.content?.[0];
    await chk(t, "A-loy Loyalty policy write (no-op save)", await a.req("PUT", `/api/admin/loyalty/policies/${pol.policyId}`, { body: { earnCurrencyPerPoint: pol.earnCurrencyPerPoint, redeemCurrencyPerPoint: pol.redeemCurrencyPerPoint, status: pol.status, version: pol.version } }), { ok: [200, 201] });
    // ---- logout guards
    await chk(t, "C-end Customer logout", await c.logout(), { pred: (j) => j.success });
    await chk(t, "C-end After logout /me = 401", await c.req("GET", "/api/customer-auth/me"), { ok: [401] });
    await chk(t, "C-end After logout cart blocked", await c.req("GET", "/api/customer-commerce/cart"), { ok: [401, 403] });
    await chk(t, "A-end Admin logout", await a.logout(), { pred: (j) => j.success });
    await chk(t, "A-end After logout admin API 401", await a.req("GET", "/api/admin/overview"), { ok: [401, 403] });
  });
}, { write: true });
