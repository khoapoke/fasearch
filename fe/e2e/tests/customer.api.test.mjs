// [customer] Guest storefront pages/APIs and a read-only logged-in CUSTOMER session.
// Ported from demo-rehearsal/rehearse.py (guest(), customer() read paths, customer_end()).
// Login/logout only create/destroy a session; nothing else is written. Write journeys live in journeys.write.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cfg } from "../lib/config.mjs";
import { suite } from "../lib/suite.mjs";
import { Client } from "../lib/http.mjs";
import { requireCreds } from "../lib/fixtures.mjs";
import { discoverProduct } from "../lib/data.mjs";
import { step, chk, pageChk, res } from "../lib/steps.mjs";

suite("customer", "storefront as guest", () => {
  test("pages, catalog API, PDP, guards", async (t) => {
    const g = new Client();
    const pid = await discoverProduct(g);
    for (const [p, n] of [["/", "Home"], ["/nam", "Catalog /nam (real listing)"], ["/nu", "Nu shell"], ["/hang-moi", "Hang moi shell"], ["/sale", "Sale shell"], ["/bo-suu-tap", "Bo suu tap shell"], ["/voucher", "Voucher"], ["/tim-kiem-ai", "AI page"], ["/dang-nhap", "Login page"], [`/san-pham/${pid}`, "PDP"]])
      await pageChk(t, `G-pg ${n}`, g, p);
    await pageChk(t, "G-pg Cart page (guest)", g, "/gio-hang", { expectPath: false });

    const brands = res((await g.req("GET", "/api/catalog/brands", { origin: false })).j) ?? [];
    const cats = res((await g.req("GET", "/api/catalog/categories", { origin: false })).j) ?? [];
    await chk(t, "G-api Catalog products API", await g.req("GET", "/api/catalog/products?size=12", { origin: false }), { pred: (j) => res(j).content.length > 0 });
    const brand = brands.find((b) => b.slug === "vans") ?? brands[0];
    await chk(t, `G-api Catalog brand filter API (${brand?.slug})`, await g.req("GET", `/api/catalog/products?brand=${brand?.slug}&size=6`, { origin: false }), { pred: (j) => res(j).content.length > 0 && res(j).content.every((x) => x.brandSlug === brand.slug) });
    const cat = cats.find((c) => c.id === 107) ?? cats[0];
    await chk(t, `G-api Catalog category filter API (${cat?.id})`, await g.req("GET", `/api/catalog/products?categoryId=${cat?.id}&size=6`, { origin: false }), { pred: (j) => res(j).content.length > 0 && res(j).content.every((x) => x.categoryId === cat.id) });
    const kw = (brand?.name ?? "a").toLowerCase();
    await chk(t, "G-api Catalog keyword + price filter", await g.req("GET", `/api/catalog/products?keyword=${encodeURIComponent(kw)}&minPrice=1&maxPrice=100000000&size=6`, { origin: false }), { pred: (j) => res(j).content.length > 0 });
    await chk(t, "G-api Brands API", await g.req("GET", "/api/catalog/brands", { origin: false }), { pred: () => brands.length > 0 });
    await chk(t, "G-api Categories API", await g.req("GET", "/api/catalog/categories", { origin: false }), { pred: () => cats.length > 0 });
    const d = await chk(t, "G-pdp PDP product + SKU variants", await g.req("GET", `/api/catalog/products/${pid}`, { origin: false }), { pred: (j) => res(j).variants.length > 0 && !!res(j).imageUrl });
    const img = res(d)?.imageUrl;
    const im = img ? await g.req("GET", img, { origin: false }) : { code: 0, buf: Buffer.alloc(0), ct: "" };
    await step(t, "G-pdp PDP image bytes", () => assert.ok(im.code === 200 && im.buf.length > 1000 && im.ct.startsWith("image/"), `http ${im.code} ${im.buf.length}B ${im.ct}`));

    for (const p of ["/api/customer-account/favorites", "/api/customer-account/search-history", "/api/customer-commerce/cart", "/api/customer-commerce/orders", "/api/customer-profile", "/api/admin/overview", "/api/admin/orders", "/api/admin/customers"])
      await chk(t, `G-guard Guest blocked: ${p.slice(5)}`, await g.req("GET", p), { ok: [401, 403] });
    for (const [p, n] of [["/lich-su-ai", "AI history"], ["/yeu-thich", "Favorites"], ["/tai-khoan", "Account"]]) {
      const body = await pageChk(t, `G-gpg Guest ${n} page shows login prompt`, g, p, { expectPath: false });
      await step(t, `G-gpg Guest ${n} page contains login link`, () => assert.ok(body.includes("dang-nhap"), "no login prompt in HTML"));
    }
    await pageChk(t, "G-gpg Guest /quan-tri shell loads (client-gated)", g, "/quan-tri", { expectPath: false });
  });
});

suite("customer", "CUSTOMER session (read-only)", () => {
  test("login, account pages, read APIs, logout", async (t) => {
    const c = new Client(); const f = requireCreds("CUSTOMER");
    const lr = await c.login(f.username, f.password);
    await chk(t, "C-auth Customer login", lr, { pred: (j) => j.identity.role === "CUSTOMER" });
    await chk(t, "C-auth Customer identity /me", await c.req("GET", "/api/customer-auth/me"), { pred: (j) => j.identity.status === "ACTIVE" });
    for (const [p, n] of [["/tai-khoan", "Account"], ["/tai-khoan/thong-tin", "Profile"], ["/tai-khoan/dia-chi", "Address page"], ["/tai-khoan/bao-mat", "Security"], ["/tai-khoan/diem-thuong", "Loyalty page"], ["/don-hang", "Orders"], ["/yeu-thich", "Favorites"], ["/lich-su-ai", "AI history"], ["/gio-hang", "Cart"]])
      await pageChk(t, `C-pg Customer page ${n}`, c, p);
    await pageChk(t, "C-pg Customer page Checkout", c, "/thanh-toan", { expectPath: false });
    for (const [p, n] of [["/api/customer-profile", "profile"], ["/api/customer-account/favorites", "favorites"], ["/api/customer-account/search-history", "search history"], ["/api/customer-commerce/cart", "cart"], ["/api/customer-commerce/orders?size=5", "orders"], ["/api/customer-commerce/offers", "offers"], ["/api/customer-commerce/loyalty", "loyalty summary"], ["/api/customer-commerce/loyalty/policy", "loyalty policy"], ["/api/customer-commerce/loyalty/history", "loyalty history"]])
      await chk(t, `C-read ${n}`, await c.req("GET", p));
    await chk(t, "C-read loyalty has balancePoints", await c.req("GET", "/api/customer-commerce/loyalty"), { pred: (j) => "balancePoints" in res(j) });
    for (const pa of ["/api/admin/overview", "/api/admin/orders", `/api/admin/reports/revenue?period=DAY&startDate=2026-01-01&endDate=2026-01-02`])
      await chk(t, `B-bnd CUSTOMER blocked from ${pa.split("?")[0].slice(5)}`, await c.req("GET", pa), { ok: [401, 403] });
    await pageChk(t, "B-bnd CUSTOMER /quan-tri shell loads (client-gated; data APIs 403)", c, "/quan-tri", { expectPath: false });
    await chk(t, "C-end Customer logout", await c.logout(), { pred: (j) => j.success });
    await chk(t, "C-end After logout /me = 401", await c.req("GET", "/api/customer-auth/me"), { ok: [401] });
    await chk(t, "C-end After logout cart blocked", await c.req("GET", "/api/customer-commerce/cart"), { ok: [401, 403] });
  });
});
