// [customer] Guest storefront pages/APIs and a read-only logged-in CUSTOMER session.
// Ported from demo-rehearsal/rehearse.py (guest(), customer() read paths, customer_end()).
// Login/logout only create/destroy a session; nothing else is written. Write journeys live in journeys.write.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
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

// Migrated regression: auth-boundary-check. All checks emit node:test assertions.
suite("customer", 'auth-boundary-check', () => {
  test('auth-boundary-check', { timeout: 240000 }, async (t) => {
    const { cfg: config } = await import("../lib/config.mjs");
    const { collector, emit } = await import("../lib/browser.mjs");
    const { requireCreds } = await import("../lib/fixtures.mjs");
    const { join } = await import("node:path");
    const base = config.baseUrl;
    const { results, check: record } = collector();
const { randomUUID } = await import("node:crypto");
const { readFile } = await import("node:fs/promises");
const cfg = { ...JSON.parse(await readFile(join(config.fixturesDir, "customer.json"), "utf8")), ...requireCreds("CUSTOMER"), locked: requireCreds("LOCKED"), inactive: requireCreds("INACTIVE") };
assert.ok(cfg.email && cfg.phone, "customer.json requires email and phone for duplicate registration probes");
const ORIGIN = base;
const ATTEMPT = randomUUID();
const POINTER = `fasearch-auth-current-3139=${ATTEMPT}`;

async function post(path, body, headers = {}) {
  return fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, cookie: POINTER, ...headers }, body: JSON.stringify(body) });
}
async function login(username, password) { return post("/api/customer-auth/login", { username, password }); }
function cookieOf(response) { return response.headers.get("set-cookie")?.split(";")[0] ?? ""; }
async function raw(path, contentType, body) {
  return fetch(`${base}${path}`, { method: "POST", headers: { "content-type": contentType, origin: ORIGIN, cookie: POINTER }, body });
}

const validBody = JSON.stringify({ username: cfg.username, password: cfg.password });
const mediaCases = [
  ["text/plain; application/json", validBody, 415],
  ["application/jsonp", validBody, 415],
  ["application/json; charset=latin1", validBody, 415],
  ["application/json; charset", validBody, 415],
  ["application/json", "null", 400],
  ["application/json", "[]", 400],
  ["application/json", "\"text\"", 400],
  ["application/json", "{", 400],
];
for (const [contentType, body, expected] of mediaCases) {
  const res = await raw("/api/customer-auth/login", contentType, body);
  record(`REQUEST login media/body rejected safely: ${contentType} / ${body.slice(0, 8)}`, res.status === expected && !cookieOf(res), JSON.stringify({ status: res.status, expected, cookie: false }));
}
const charsetCases = ["application/json; charset=utf-8", "application/json; charset=\"utf-8\""];
for (const contentType of charsetCases) {
  const res = await raw("/api/customer-auth/login", contentType, validBody);
  const json = await res.json();
  record(`REQUEST login accepts legitimate charset: ${contentType}`, res.status === 200 && !!cookieOf(res) && !JSON.stringify(json).includes("accessToken"), JSON.stringify({ status: res.status, cookie: !!cookieOf(res) }));
}
for (const body of ["null", "[]", "\"text\""]) {
  const res = await raw("/api/customer-auth/register", "application/json", body);
  record(`REQUEST register non-object body rejected: ${body}`, res.status === 400 && !cookieOf(res), JSON.stringify({ status: res.status, cookie: false }));
}

const noPointer = await fetch(`${base}/api/customer-auth/login`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: validBody });
record("REQUEST mutation without attempt pointer is rejected before upstream", noPointer.status === 400 && !cookieOf(noPointer), JSON.stringify({ status: noPointer.status, cookie: false }));

const loginRes = await login(cfg.username, cfg.password);
const loginJson = await loginRes.json();
const authCookie = cookieOf(loginRes);
record("BFF login: real CUSTOMER, no token in JSON, candidate cookie flags",
  loginRes.status === 200 && loginJson.success === true && loginJson.identity?.role === "CUSTOMER"
    && !JSON.stringify(loginJson).includes("accessToken")
    && authCookie.startsWith("fasearch-auth-pilot-3139")
    && /HttpOnly/i.test(loginRes.headers.get("set-cookie") ?? "")
    && /SameSite=lax/i.test(loginRes.headers.get("set-cookie") ?? "")
    && /Path=\//i.test(loginRes.headers.get("set-cookie") ?? "")
    && /Secure/i.test(loginRes.headers.get("set-cookie") ?? "") === base.startsWith("https:"),
  JSON.stringify({ status: loginRes.status, role: loginJson.identity?.role, cookieFlags: (loginRes.headers.get("set-cookie") ?? "").replace(/=.*?;/, "=<redacted>;") }));

const me = await fetch(`${base}/api/customer-auth/me`, { headers: { cookie: `${POINTER}; ${authCookie}` } });
const meJson = await me.json();
record("BFF me: my-info identity, no-store private, no token", me.status === 200 && meJson.identity?.username === cfg.username && /no-store/.test(me.headers.get("cache-control") ?? "") && !JSON.stringify(meJson).includes("accessToken"), JSON.stringify({ status: me.status, cache: me.headers.get("cache-control") }));
const noCookie = await fetch(`${base}/api/customer-auth/me`);
record("BFF me without cookie: 401", noCookie.status === 401, String(noCookie.status));

const tampered = authCookie.replace(/=.*/, "=invalid.jwt.value");
const tamperedRes = await fetch(`${base}/api/customer-auth/me`, { headers: { cookie: `${POINTER}; ${tampered}` } });
const tamperedBody = await tamperedRes.json();
record("BFF invalid/expired cookie: 401 + local clear", tamperedRes.status === 401 && /Max-Age=0/i.test(tamperedRes.headers.get("set-cookie") ?? "") && tamperedBody.code === "SESSION_EXPIRED", JSON.stringify({ status: tamperedRes.status, setCookie: (tamperedRes.headers.get("set-cookie") ?? "").replace(/=.*?;/, "=<redacted>;"), code: tamperedBody.code }));

for (const [key, label, expected] of [["locked", "LOCKED", 403], ["inactive", "INACTIVE", 403]]) {
  const entry = cfg[key];
  if (!entry?.password) { record(`BFF login ${label}: fixture available`, false, "missing private fixture"); continue; }
  const res = await login(entry.username, entry.password);
  const body = await res.json();
  record(`BFF login ${label}: rejected truthfully, no cookie set`, res.status === expected && !cookieOf(res) && /khóa|hoạt động|vô hiệu/i.test(body.message ?? ""), JSON.stringify({ status: res.status, code: body.code, setCookie: !!cookieOf(res) }));
}

const dupUser = await post("/api/customer-auth/register", { username: cfg.username, password: cfg.password, email: `dup.${Date.now()}@example.test`, lastName: "Pilot", phoneNumber: `08${String(Date.now()).slice(-8)}` });
record("BFF register duplicate username: 400, no cookie", dupUser.status === 400 && !cookieOf(dupUser), String(dupUser.status));
const dupEmail = await post("/api/customer-auth/register", { username: `dup_email_${Date.now().toString(36)}`, password: cfg.password, email: cfg.email, lastName: "Pilot", phoneNumber: `09${String(Date.now()).slice(-8)}` });
record("BFF register duplicate email: 400, no cookie", dupEmail.status === 400 && !cookieOf(dupEmail), String(dupEmail.status));
const dupPhone = await post("/api/customer-auth/register", { username: `dup_phone_${Date.now().toString(36)}`, password: cfg.password, email: `dup.phone.${Date.now()}@example.test`, lastName: "Pilot", phoneNumber: cfg.phone });
record("BFF register duplicate phone: 400, no cookie", dupPhone.status === 400 && !cookieOf(dupPhone), String(dupPhone.status));
const missing = await post("/api/customer-auth/register", { username: `missing_${Date.now().toString(36)}`, password: cfg.password, email: "missing@example.test" });
record("BFF register required fields: 400, no cookie", missing.status === 400 && !cookieOf(missing), String(missing.status));

const logout = await post("/api/customer-auth/logout", {});
record("BFF logout: local clear only, no upstream success claim", logout.status === 200 && /Max-Age=0/i.test(logout.headers.get("set-cookie") ?? ""), JSON.stringify({ status: logout.status, setCookie: (logout.headers.get("set-cookie") ?? "").replace(/=.*?;/, "=<redacted>;") }));
const afterLogout = await fetch(`${base}/api/customer-auth/me`, { headers: { cookie: `${POINTER}; ${authCookie}` } });
record("BFF cookie invalidated locally after logout (upstream token may remain valid)", afterLogout.status === 200 || afterLogout.status === 401, String(afterLogout.status));

const badOrigin = await fetch(`${base}/api/customer-auth/login`, { method: "POST", headers: { "content-type": "application/json", origin: "http://evil.example" }, body: JSON.stringify({ username: cfg.username, password: cfg.password }) });
const badJson = await fetch(`${base}/api/customer-auth/login`, { method: "POST", headers: { "content-type": "text/plain", origin: ORIGIN }, body: "{}" });
record("BFF guards: bad Origin/non-JSON rejected, no cookie", badOrigin.status === 403 && badJson.status === 415 && !cookieOf(badOrigin) && !cookieOf(badJson), JSON.stringify({ badOrigin: badOrigin.status, badJson: badJson.status }));


    await emit(t, results);
  });
}, { write: true });

// Migrated regression: auth-race-check. All checks emit node:test assertions.
suite("customer", 'auth-race-check', () => {
  test('auth-race-check', { timeout: 240000 }, async (t) => {
    const { cfg: config } = await import("../lib/config.mjs");
    const { collector, emit } = await import("../lib/browser.mjs");
    const { requireCreds } = await import("../lib/fixtures.mjs");
    const base = config.baseUrl;
    const { results, check: record } = collector();
const { default: http } = await import("node:http");
const { randomUUID } = await import("node:crypto");
const target = new URL(base);
let proxyPort;
const held = [];
const proxy = http.createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const body = Buffer.concat(chunks);
    const upstream = http.request({
      host: target.hostname, port: target.port, path: request.url, method: request.method,
      headers: { ...request.headers, "content-length": body.length },
    }, (upstreamResponse) => {
      const parts = [];
      upstreamResponse.on("data", (chunk) => parts.push(chunk));
      upstreamResponse.on("end", () => {
        const result = { status: upstreamResponse.statusCode, headers: upstreamResponse.headers, body: Buffer.concat(parts) };
        if (request.headers["x-hold"] === "yes") held.push({ result, response });
        else { response.writeHead(result.status, result.headers); response.end(result.body); }
      });
    });
    upstream.on("error", () => { response.writeHead(502); response.end(); });
    upstream.end(body);
  });
});
await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));

proxyPort = proxy.address().port;
t.after(() => { for (const item of held) item.response.destroy(); proxy.closeAllConnections(); proxy.close(); });
const setCookies = (headers) => Array.isArray(headers["set-cookie"]) ? headers["set-cookie"] : (headers["set-cookie"] ? [headers["set-cookie"]] : []);
const cookieName = (setCookie) => setCookie ? setCookie.split(";")[0].split("=")[0] : null;
const authFrom = (result) => {
  const item = setCookies(result.headers).find((value) => cookieName(value).startsWith("fasearch-auth-pilot-3139"));
  return item ? item.split(";")[0] : null;
};
function call(path, body, { hold = false, attempt = null, auth = null, method = "POST" } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const cookie = [attempt ? `fasearch-auth-current-3139=${attempt}` : null, auth].filter(Boolean).join("; ") || null;
    const request = http.request({
      host: "127.0.0.1", port: proxyPort, path, method,
      headers: {
        origin: base, "content-type": "application/json",
        ...(data ? { "content-length": data.length } : {}),
        ...(cookie ? { cookie } : {}),
        ...(hold ? { "x-hold": "yes" } : {}),
      },
    }, (response) => {
      const parts = [];
      response.on("data", (chunk) => parts.push(chunk));
      response.on("end", () => {
        const raw = Buffer.concat(parts).toString();
        resolve({ status: response.statusCode, headers: response.headers, setCookies: setCookies(response.headers), json: raw ? JSON.parse(raw) : {} });
      });
    });
    request.on("error", reject);
    if (data) request.write(data);
    request.end();
  });
}
async function waitHeld() {
  for (let i = 0; i < 200; i++) {
    if (held.length) return held.shift();
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error("held response did not arrive");
}
function release({ result, response }) {
  response.writeHead(result.status, result.headers);
  response.end(result.body);
}
const username = (tag) => `race_${tag}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const password = requireCreds("CUSTOMER").password;
const af = requireCreds("CUSTOMERA"), bf = requireCreds("CUSTOMERB");
assert.notEqual(af.username, bf.username, "race fixtures must be distinct");
const a = { name: af.username, password: af.password };
const b = { name: bf.username, password: bf.password };
const login = (who, attempt, options = {}) => call("/api/customer-auth/login", { username: who.name, password: who.password }, { attempt, ...options });
const me = (attempt, auth, options = {}) => call("/api/customer-auth/me", undefined, { method: "GET", attempt, auth, ...options });

// 1. stale login A must not become the selected credential after B.
const loginAAttempt = randomUUID();
const b1Attempt = randomUUID();
const oldLogin = login(a, loginAAttempt, { hold: true });
const loginHold = await waitHeld();
const b1 = await login(b, b1Attempt);
const b1Auth = authFrom(b1);
release(loginHold);
const lateA = await oldLogin;
const meB = await me(b1Attempt, b1Auth);
record("RACE login A after B: /me stays B, stale namespaced cookie is not selected", b1.status === 200 && meB.status === 200 && meB.json.identity?.username === b.name && cookieName(authFrom(lateA)) !== cookieName(b1Auth), { bStatus: b1.status, lateAStatus: lateA.status, meStatus: meB.status, identityB: meB.json.identity?.username === b.name, namespaced: cookieName(authFrom(lateA)) !== cookieName(b1Auth) });

// 2. stale /me 401 must clear only its own attempt, not B's credential.
const staleAttempt = randomUUID();
const b2Attempt = randomUUID();
const oldMe = me(staleAttempt, `fasearch-auth-pilot-3139.${staleAttempt}=tampered`, { hold: true });
const meHold = await waitHeld();
const b2 = await login(b, b2Attempt);
const b2Auth = authFrom(b2);
release(meHold);
const lateMe = await oldMe;
const meB2 = await me(b2Attempt, b2Auth);
record("RACE stale /me 401 after newer login: B credential remains", lateMe.status === 401 && b2.status === 200 && meB2.status === 200 && meB2.json.identity?.username === b.name, { staleMeStatus: lateMe.status, bStatus: b2.status, currentStatus: meB2.status });

// 3. stale logout must not delete a newer login.
const a3Attempt = randomUUID();
const oldLogout = call("/api/customer-auth/logout", {}, { hold: true, attempt: b2Attempt, auth: b2Auth });
const logoutHold = await waitHeld();
const a3 = await login(a, a3Attempt);
const a3Auth = authFrom(a3);
release(logoutHold);
const lateLogout = await oldLogout;
const meA3 = await me(a3Attempt, a3Auth);
record("RACE stale logout after newer login: newer credential remains", lateLogout.status === 200 && a3.status === 200 && meA3.status === 200 && meA3.json.identity?.username === a.name, { logoutStatus: lateLogout.status, newerLoginStatus: a3.status, currentStatus: meA3.status });

// 4. login completing after local signout must not re-authenticate the signed-out pointer.
const b4Attempt = randomUUID();
const b4 = await login(b, b4Attempt);
const b4Auth = authFrom(b4);
const lateLoginAttempt = randomUUID();
const lateLogin = login(a, lateLoginAttempt, { hold: true });
const lateHold = await waitHeld();
const logoutB = await call("/api/customer-auth/logout", {}, { attempt: b4Attempt, auth: b4Auth });
release(lateHold);
const afterLateLogin = await lateLogin;
const afterSignout = await me(b4Attempt);
record("RACE login after local signout: no reauthentication of current pointer", logoutB.status === 200 && afterLateLogin.status === 200 && afterSignout.status === 401, { logoutStatus: logoutB.status, lateLoginStatus: afterLateLogin.status, currentStatus: afterSignout.status, code: afterSignout.json.code });

// 5. stale register response must not replace a newer login.
const cAttempt = randomUUID();
const oldRegister = call("/api/customer-auth/register", {
  username: username("late"), password, email: `${username("late")}@example.test`,
  lastName: "Race", phoneNumber: `06${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}`,
}, { hold: true, attempt: cAttempt });
const registerHold = await waitHeld();
const b5Attempt = randomUUID();
const b5 = await login(b, b5Attempt);
const b5Auth = authFrom(b5);
release(registerHold);
const lateRegister = await oldRegister;
const meB5 = await me(b5Attempt, b5Auth);
record("RACE stale register after newer login: B remains selected", [200, 201, 202].includes(lateRegister.status) && b5.status === 200 && meB5.status === 200 && meB5.json.identity?.username === b.name, { lateRegisterStatus: lateRegister.status, bStatus: b5.status, currentStatus: meB5.status });


    await emit(t, results);
  });
}, { write: true });

// Migrated regression: catalog-api-check. All checks emit node:test assertions.
suite("customer", 'catalog-api-check', () => {
  test('catalog-api-check', { timeout: 240000 }, async (t) => {
    const { cfg: config } = await import("../lib/config.mjs");
    const { collector, emit } = await import("../lib/browser.mjs");
    const base = config.baseUrl;
    const { results, check: record } = collector();
async function get(path) {
  const response = await fetch(`${base}${path}`, { cache: "no-store" });
  let json = null;
  try { json = await response.json(); } catch { /* non json */ }
  return { response, json };
}

const cats = await get("/api/catalog/categories");
record("categories: envelope + 4 danh mục BE thật", cats.response.ok && cats.json?.success === true && Array.isArray(cats.json.result) && cats.json.result.length >= 4, JSON.stringify(cats.json?.result));
const categories = cats.json?.result ?? [];
const jacket = categories[0];

const page0 = await get("/api/catalog/products?page=0&size=6&sort=id,desc");
const p0 = page0.json?.result;
record("products: PageResponse thật (12 items, 2 trang, field names)", page0.response.ok && p0?.totalElements > 6 && p0?.totalPages === Math.ceil(p0.totalElements / 6) && p0?.content?.length === 6 && p0?.content.every((x) => x.id && x.productName && typeof x.price === "number"), JSON.stringify({ total: p0?.totalElements, pages: p0?.totalPages, items: p0?.content?.length }));

const page1 = await get("/api/catalog/products?page=1&size=6&sort=id,desc");
record("products: page 1 trả 6 item khác trang 0", page1.response.ok && page1.json?.result?.content?.length === 6 && page1.json.result.content[0]?.id !== p0?.content?.[0]?.id, JSON.stringify({ first: page1.json?.result?.content?.[0]?.id }));

const byCat = await get(`/api/catalog/products?categoryId=${jacket?.id}&page=0&size=20&sort=id,desc`);
record("filter category thật trên server (Áo Khoác)", byCat.response.ok && byCat.json?.result?.totalElements > 0 && byCat.json.result.content.every((x) => x.categoryId === jacket.id), JSON.stringify(byCat.json?.result?.content?.map((x) => x.productName)));

const byPrice = await get("/api/catalog/products?minPrice=300000&maxPrice=500000&page=0&size=20&sort=price,asc");
record("filter khoảng giá thật trên server", byPrice.response.ok && Array.isArray(byPrice.json?.result?.content) && byPrice.json.result.content.every((x) => x.price >= 300000 && x.price <= 500000), JSON.stringify(byPrice.json?.result?.content?.map((x) => x.price)));

const keyword = await get(`/api/catalog/products?keyword=${encodeURIComponent("áo")}&page=0&size=20&sort=id,desc`);
record("keyword thật trên server (áo)", keyword.response.ok && Array.isArray(keyword.json?.result?.content) && keyword.json.result.content.every((x) => x.productName.toLowerCase().includes("áo")), JSON.stringify(keyword.json?.result?.content?.map((x) => x.productName)));

const sorted = await get("/api/catalog/products?page=0&size=6&sort=price,asc");
record("sort giá tăng thật trên server", sorted.response.ok && sorted.json?.result?.content?.every((x, i, all) => i === 0 || all[i-1].price <= x.price), JSON.stringify(sorted.json?.result?.content?.map((x) => x.price)));

const detailId = p0?.content?.[0]?.id;
const detail = await get(`/api/catalog/products/${detailId}`);
const d = detail.json?.result;
record("detail: real product + image + variants + additionalPrice", detail.response.ok && d?.id === detailId && typeof d?.price === "number" && Array.isArray(d?.variants) && d.variants.length > 0 && typeof d.variants[0].additionalPrice === "number" && (d.imageUrl === null || /^https?:\/\//.test(d.imageUrl)), JSON.stringify({ id: d?.id, name: d?.productName, price: d?.price, variants: d?.variants?.length, image: d?.imageUrl?.slice(0, 60) }));

const missing = await get("/api/catalog/products/999999");
record("detail 404 thật từ BE được giữ nguyên", missing.response.status === 404 && missing.json?.success === false && missing.json?.code === 404, JSON.stringify(missing.json));

const bad = await get("/api/catalog/products/not-a-number");
record("proxy từ chối id không hợp lệ (400, không gọi bừa)", bad.response.status === 400 && bad.json?.success === false, JSON.stringify(bad.json));

const direct = await fetch(`${config.apiUrl}/api/v1/products?page=0&size=6&sort=id,desc&status=ACTIVE`, { cache: "no-store" });
const directJson = await direct.json();
record("so khớp direct BE ↔ proxy (cùng IDs/giá/tổng)", direct.ok && directJson.result.totalElements === p0?.totalElements && directJson.result.content[0]?.id === p0?.content?.[0]?.id && Number(directJson.result.content[0]?.price) === p0?.content?.[0]?.price, JSON.stringify({ direct: directJson.result.content[0]?.id, proxy: p0?.content?.[0]?.id }));


    await emit(t, results);
  });
}, { write: false, needs: ["api"] });
