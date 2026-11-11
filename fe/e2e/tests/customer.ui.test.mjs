// [customer] Browser checks: catalog filters/pager/price/search/selection (incl. reduced + Motion Off),
// motion (navbar, marquee, theme menu, PDP stepper/CTA, Off toggle) and nav listing pages.
// The catalog/motion check bodies are ported from catalog-motion-completion/live/combined/verify-*/.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cfg } from "../lib/config.mjs";
import { suite } from "../lib/suite.mjs";
import { launch, collector, emit, shotDir, finishShots } from "../lib/browser.mjs";
import { step } from "../lib/steps.mjs";
import { runCatalogChecks } from "../ui/catalog-checks.mjs";
import { runMotionChecks } from "../ui/motion-checks.mjs";
import { runMotionToggleChecks } from "../ui/motion-toggle-checks.mjs";

suite("customer", "storefront UI", () => {
  let browser;
  before(async () => { browser = await launch(); });
  after(async () => { await browser?.close(); });

  // Capability probe: older builds (e.g. the frozen baseline) have no catalog filter panel / motion layer.
  async function probe() {
    const c = await browser.newContext(); const p = await c.newPage();
    await p.goto(cfg.baseUrl + "/nam", { waitUntil: "networkidle" });
    const r = { catalog: (await p.locator(".cat-filter-desktop").count()) > 0 };
    await p.goto(cfg.baseUrl + "/", { waitUntil: "networkidle" });
    r.motion = (await p.locator("header.chHeader").count()) > 0;
    await c.close();
    return r;
  }

  async function runPorted(t, name, fn, capability) {
    const cap = await probe();
    if (!cap[capability]) return t.skip(`build lacks the ${capability} UI (feature probe on ${cfg.baseUrl})`);
    const { check, results } = collector(); const { dir, SHOT } = shotDir(name);
    try { await fn({ browser, base: cfg.baseUrl, check, SHOT }); }
    catch (e) { results.push({ name: `${name} aborted: ${String(e.message).split("\n")[0]}`, ok: false, detail: "" }); }
    await emit(t, results);
    finishShots(dir, results.some((r) => !r.ok));
  }

  test("catalog filters / pager / price / search / selection (desktop + mobile, reduced, Motion Off)", { timeout: 900000 }, (t) => runPorted(t, "catalog", runCatalogChecks, "catalog"));
  test("motion: navbar, marquee, theme menu, PDP CTA, reduced/Off", { timeout: 600000 }, (t) => runPorted(t, "motion", runMotionChecks, "motion"));
  test("motion: same-tab Motion Off/On toggle follows live", { timeout: 300000 }, (t) => runPorted(t, "motion-toggle", runMotionToggleChecks, "catalog"));

  test("nav listing pages show products without the retired legacy proxy", async (t) => {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    for (const path of ["/nu", "/hang-moi", "/sale", "/bo-suu-tap"]) {
      const p = await c.newPage();
      await p.goto(cfg.baseUrl + path, { waitUntil: "networkidle" });
      await p.waitForTimeout(500);
      const info = await p.evaluate(() => ({ links: document.querySelectorAll('a[href*="/san-pham/"]').length, legacy: /Legacy proxy|Không kết nối|0 sản phẩm/i.test(document.body.innerText) }));
      await step(t, `Nav listings ${path} load products`, () => assert.ok(info.links > 0 && !info.legacy, `product links=${info.links} legacyText=${info.legacy}`));
      await p.close();
    }
    await c.close();
  });
});

// Migrated regression: catalog-resilience-check. All checks emit node:test assertions.
suite("customer", 'catalog-resilience-check', () => {
  test('catalog-resilience-check', { timeout: 240000 }, async (t) => {
    const { cfg: config } = await import("../lib/config.mjs");
    const { regressionPage, collector, emit } = await import("../lib/browser.mjs");
    const { setTimeout: sleep } = await import("node:timers/promises");
    const base = config.baseUrl;
    const { results, check: record } = collector();

const page = await regressionPage(t);


// Load real payloads for controlled interception (read-only).
const realCategories = await (await fetch(`${base}/api/catalog/categories`)).json();
const realProducts = await (await fetch(`${base}/api/catalog/products?page=0&size=6&sort=id,desc`)).json();
const malformedPrice = JSON.parse(JSON.stringify(realProducts));
delete malformedPrice.result.content[0].price;
const zeroPrice = JSON.parse(JSON.stringify(realProducts));
zeroPrice.result.content[0].price = 0;

let categoryPhase = "fail";
let productPhase = "ok";
let categoryRequests = 0;
const body = (value) => Buffer.from(JSON.stringify(value)).toString("base64");
async function fulfill(requestId, value, code = 200) {
  await page.send("Fetch.fulfillRequest", {
    requestId,
    responseCode: code,
    responseHeaders: [{ name: "content-type", value: "application/json" }],
    body: body(value),
  });
}
page.on("Fetch.requestPaused", async (params) => {
  try {
    const url = params.request.url;
    if (url.includes("/api/catalog/categories")) {
      categoryRequests += 1;
      if (categoryPhase === "fail") {
        return await fulfill(params.requestId, { success: false, code: 503, message: "Danh mục tạm thời không tải được.", result: null }, 503);
      }
      return await fulfill(params.requestId, realCategories);
    }
    if (url.includes("/api/catalog/products?")) {
      if (productPhase === "missing-price") return await fulfill(params.requestId, malformedPrice);
      if (productPhase === "zero-price") return await fulfill(params.requestId, zeroPrice);
      return await page.send("Fetch.continueRequest", { requestId: params.requestId });
    }
    return await page.send("Fetch.continueRequest", { requestId: params.requestId });
  } catch {
    /* request aborted */
  }
});
await page.send("Fetch.enable", {
  patterns: [{ urlPattern: "*api/catalog/categories*" }, { urlPattern: "*api/catalog/products?*" }],
});
await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

const waitFor = async (fn, timeout = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return true;
    await sleep(120);
  }
  return false;
};
const setNative = (selector, value) => page.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);

// 1) Categories 503: product list still real; explicit retry recovers in page, filters survive.
await page.goto(`${base}/nam`);
await waitFor(async () => (await page.eval(`document.querySelectorAll('.cat-product-card').length`)) === 6);
const catFail = await page.eval(`(() => ({
  options: [...document.querySelectorAll('.cat-filter-desktop .cat-filter-option span')].map((x) => x.textContent),
  retry: [...document.querySelectorAll('.cat-filter-desktop button')].some((b) => b.textContent.includes('Thử lại danh mục')),
  error: document.querySelector('.cat-filter-desktop .cat-filter-note[role="alert"]')?.textContent ?? "",
  cards: document.querySelectorAll('.cat-product-card').length,
  sort: document.querySelector('#listing-sort')?.value,
}))()`);
await setNative("#desktop-keyword", "áo");
await page.eval(`document.querySelector('.cat-filter-desktop .cat-filter-apply')?.click()`);
await waitFor(async () => !(await page.eval(`document.querySelector('.cat-result-count')?.textContent ?? ""`)).includes("Đang cập nhật"));
const countBeforeRetry = await page.eval(`document.querySelector('.cat-result-count')?.textContent`);
categoryPhase = "ok";
await page.eval(`[...document.querySelectorAll('.cat-filter-desktop button')].find((b) => b.textContent.includes('Thử lại danh mục'))?.click()`);
const catRecovered = await waitFor(async () => (await page.eval(`document.querySelectorAll('.cat-filter-desktop .cat-filter-option input').length`)) === realCategories.result.length + 1);
const catAfter = await page.eval(`(() => ({
  options: [...document.querySelectorAll('.cat-filter-desktop .cat-filter-option span')].map((x) => x.textContent),
  error: document.querySelector('.cat-filter-desktop .cat-filter-note[role="alert"]')?.textContent ?? null,
  keyword: document.querySelector('#desktop-keyword')?.value,
  count: document.querySelector('.cat-result-count')?.textContent,
  categoryRequests: ${categoryRequests + 0},
}))()`);
record("CATEGORY 503: lỗi danh mục có nút retry, product list vẫn thật; retry phục hồi tại chỗ giữ filter",
  catFail.options.length === 1 && catFail.retry && /Danh mục/.test(catFail.error) && catFail.cards === 6
    && catRecovered && catAfter.options.length === realCategories.result.length + 1 && !catAfter.error && catAfter.keyword === "áo" && catAfter.count === countBeforeRetry,
  JSON.stringify({ catFail, catRecovered, catAfter, categoryRequests }));

// 2) HTTP200 missing required price: error, never invented 0 ₫ or empty success.
productPhase = "missing-price";
await page.goto(`${base}/nam`);
const malformed = await waitFor(async () => (await page.eval(`!!document.querySelector('.cat-status.cat-error')`)) === true);
const malformedState = await page.eval(`(() => ({
  cards: document.querySelectorAll('.cat-product-card').length,
  zero: document.body.innerText.includes("0đ"),
  error: document.querySelector('.cat-status.cat-error')?.textContent?.slice(0, 90) ?? "",
  retry: [...document.querySelectorAll('.cat-status.cat-error button')].some((b) => b.textContent.includes('Thử lại')),
}))()`);
record("PRICE malformed HTTP200: thiếu price bị từ chối, không hiện 0 ₫/empty success",
  malformed && malformedState.cards === 0 && malformedState.zero === false && /không hợp lệ|Thử lại/.test(malformedState.error) && malformedState.retry,
  JSON.stringify(malformedState));

// 3) Valid price 0 is preserved (not conflated with missing price).
productPhase = "zero-price";
await page.eval(`[...document.querySelectorAll('.cat-status.cat-error button')].find((b) => b.textContent.includes('Thử lại'))?.click()`);
const zeroOk = await waitFor(async () => (await page.eval(`document.querySelector('.cat-product-price')?.textContent`)) === "0đ");
const zeroState = await page.eval(`({ firstPrice: document.querySelector('.cat-product-price')?.textContent, error: !!document.querySelector('.cat-status.cat-error') })`);
record("PRICE 0 hợp lệ vẫn hiển thị 0 ₫ (không bị coi là lỗi)", zeroOk && zeroState.firstPrice === "0đ" && !zeroState.error, JSON.stringify(zeroState));


    await emit(t, results);
  });
}, { write: false });

// Migrated regression: auth-ui-check. All checks emit node:test assertions.
suite("customer", 'auth-ui-check', () => {
  test('auth-ui-check', { timeout: 240000 }, async (t) => {
    const { cfg: config, ensureRunDir } = await import("../lib/config.mjs");
    const { regressionPage, collector, emit } = await import("../lib/browser.mjs");
    const { requireCreds } = await import("../lib/fixtures.mjs");
    const { setTimeout: sleep } = await import("node:timers/promises");
    const { join } = await import("node:path");
    const { mkdir } = await import("node:fs/promises");
    const base = config.baseUrl, outDir = ensureRunDir();
    const { results, check: record } = collector();
const shots = join(outDir, "auth-ui"); await mkdir(shots, { recursive: true });

const page = await regressionPage(t);


const waitFor = async (fn, timeout = 12000) => { const start = Date.now(); while (Date.now() - start < timeout) { if (await fn()) return true; await sleep(120); } return false; };
const setNative = (selector, value, proto = "HTMLInputElement") => page.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const set = Object.getOwnPropertyDescriptor(${proto}.prototype, 'value').set; set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
const cookies = async () => (await page.send("Network.getAllCookies")).cookies;
const waitPath = (path) => waitFor(async () => (await page.eval(`location.pathname`)) === path);

const stamp = Date.now().toString(36);
const username = `ui_auth_${stamp}`;
const password = requireCreds("CUSTOMER").password;
const email = `${username}@example.test`;
const phone = `09${String(Date.now()).slice(-8)}`;

// Login page structure.
await page.send("Network.clearBrowserCookies");
await page.setViewport(1440, 1000);
await page.goto(`${base}/dang-nhap`);
const attrs = await page.eval(`(() => { const u=document.querySelector('#login-username'),pw=document.querySelector('#login-password'),f=document.querySelector('form'); return { usernameAutocomplete:u?.getAttribute('autocomplete'), passwordAutocomplete:pw?.getAttribute('autocomplete'), labels:[...document.querySelectorAll('.auth-form label')].map(x=>x.textContent), passwordType:pw?.type, busy:f?.getAttribute('aria-busy') }; })()`);
record("AUTH login fields editable, labels/autocomplete native-safe", attrs.usernameAutocomplete === "username" && attrs.passwordAutocomplete === "current-password" && attrs.passwordType === "password" && attrs.busy === "false", JSON.stringify(attrs));

// Register a fresh synthetic account through real UI/BFF.
await page.goto(`${base}/dang-ky`);
await setNative("#register-username", username);
await setNative("#register-password", password);
await setNative("#register-email", email);
await setNative("#register-firstName", "Pilot");
await setNative("#register-lastName", "Kiểm thử");
await setNative("#register-phoneNumber", phone);
await setNative("#register-gender", "OTHER", "HTMLSelectElement");
await page.eval(`document.querySelector('form').requestSubmit()`);
const registered = await waitPath("/tai-khoan");
const regIdentity = await waitFor(async () => Boolean(await page.eval(`document.querySelector('.acct-identity strong')?.textContent`)));
record("AUTH register real HTTP: CUSTOMER account created and redirected to account", registered && regIdentity, JSON.stringify({ registered, identity: await page.eval(`document.querySelector('.acct-identity strong')?.textContent`) }));

const cookieList = await cookies();
const isAuthCookieName = (name) => name === "fasearch-auth-pilot-3139" || name.startsWith("fasearch-auth-pilot-3139.");
const authCookie = cookieList.find((c) => isAuthCookieName(c.name));
const tokenLeak = await page.eval(`(() => ({ cookie: document.cookie, local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage), htmlHasToken: /accessToken|eyJ[A-Za-z0-9_-]{10,}/.test(document.documentElement.innerHTML) }))()`);
record("AUTH cookie: unique HttpOnly SameSite=Lax Path=/ bounded expiry, no token in JS/storage/HTML",
  !!authCookie && authCookie.httpOnly === true && authCookie.sameSite === "Lax" && authCookie.path === "/"
    && authCookie.secure === base.startsWith("https:") && authCookie.session === false && authCookie.expires > Date.now() / 1000
    && authCookie.expires <= Date.now() / 1000 + 86400 + 120
    && !tokenLeak.cookie.includes("fasearch-auth-pilot-3139") && !tokenLeak.local.includes("eyJ") && !tokenLeak.session.includes("eyJ") && !tokenLeak.htmlHasToken,
  JSON.stringify({ cookie: authCookie ? { name: authCookie.name, httpOnly: authCookie.httpOnly, sameSite: authCookie.sameSite, path: authCookie.path, secure: authCookie.secure, session: authCookie.session, expires: authCookie.expires } : null, tokenLeak: { authCookieHidden: !tokenLeak.cookie.includes("fasearch-auth-pilot-3139"), pointerCookie: tokenLeak.cookie, storageNoToken: !tokenLeak.local.includes("eyJ") && !tokenLeak.session.includes("eyJ"), htmlNoToken: !tokenLeak.htmlHasToken } }));

await page.shot(join(shots, "account-authenticated-1440-light.png"));

// Logout local-only; guest account state.
await page.eval(`[...document.querySelectorAll('.acct-logout')][0]?.click()`);
const loggedOut = await waitPath("/dang-nhap");
const cookieAfter = (await cookies()).some((c) => isAuthCookieName(c.name));
const logoutPosts = page.requests.filter((r) => r.url.includes("/api/customer-auth/logout") && r.method === "POST").length;
record("AUTH logout: local cookie cleared, returns to login", loggedOut && !cookieAfter && logoutPosts >= 1, JSON.stringify({ loggedOut, cookieAfter, logoutPosts }));
await page.goto(`${base}/tai-khoan`);
await sleep(1000);
record("AUTH guest account: sign-in state", await page.eval(`document.body.innerText.includes("Cần đăng nhập")`), "no authenticated account data");

// Wrong password then correct login, reload persistence.
await page.goto(`${base}/dang-nhap`);
await setNative("#login-username", username);
await setNative("#login-password", password + "-invalid");
await page.eval(`document.querySelector('form').requestSubmit()`);
const wrong = await waitFor(async () => (await page.eval(`!!document.querySelector('.auth-status.is-error')`)) === true);
record("AUTH invalid credentials: truthful error, stays on login", wrong && (await page.eval(`location.pathname`)) === "/dang-nhap", await page.eval(`document.querySelector('.auth-status.is-error')?.textContent`));
await setNative("#login-password", password);
await page.eval(`document.querySelector('form').requestSubmit()`);
const loginOk = await waitPath("/tai-khoan");
await sleep(900);
const loggedIn = await page.eval(`document.querySelector('.acct-identity strong')?.textContent`);
record("AUTH login real HTTP: CUSTOMER identity visible", loginOk && loggedIn === username, JSON.stringify({ loginOk, loggedIn }));
await page.send("Page.reload"); await sleep(1500);
const persisted = await waitFor(async () => (await page.eval(`document.querySelector('.acct-identity strong')?.textContent`)) === username);
record("AUTH reload: my-info persists via HttpOnly cookie", persisted, username);

// Password show/hide + external return path rejection.
await page.send("Network.clearBrowserCookies");
await page.goto(`${base}/dang-nhap`);
const toggleBefore = await page.eval(`({ type: document.querySelector('#login-password')?.type, pressed: document.querySelector('.auth-eye')?.getAttribute('aria-pressed') })`);
await page.eval(`document.querySelector('.auth-eye')?.click()`);
const toggleAfter = await page.eval(`({ type: document.querySelector('#login-password')?.type, pressed: document.querySelector('.auth-eye')?.getAttribute('aria-pressed') })`);
record("AUTH password toggle: native button changes type and aria-pressed", toggleBefore.type === "password" && toggleBefore.pressed === "false" && toggleAfter.type === "text" && toggleAfter.pressed === "true", JSON.stringify({ toggleBefore, toggleAfter }));
await page.goto(`${base}/dang-nhap?next=https%3A%2F%2Fevil.example`);
await setNative("#login-username", username);
await setNative("#login-password", password);
await page.eval(`document.querySelector('form').requestSubmit()`);
const safeReturn = await waitFor(async () => (await page.eval(`location.pathname`)) === "/tai-khoan");
record("AUTH safe return: external next rejected to /tai-khoan", safeReturn, await page.eval(`location.pathname`));
await page.send("Network.clearBrowserCookies");
await page.goto(`${base}/dang-nhap?next=%2Ftai-khoan%2Fbao-mat`);
await setNative("#login-username", username);
await setNative("#login-password", password);
await page.eval(`document.querySelector('form').requestSubmit()`);
const legacyReturn = await waitFor(async () => (await page.eval(`location.pathname`)) === "/tai-khoan/bao-mat");
await sleep(1800);
const legacyStayed = (await page.eval(`location.pathname`)) === "/tai-khoan/bao-mat";
record("AUTH legacy next target is narrowed to /tai-khoan with no redirect loop", legacyReturn && legacyStayed, JSON.stringify({ path: await page.eval(`location.pathname`), legacyStayed }));

// Double-submit guard on login (observe at most one BFF login request from this form).
const beforeLoginReqs = page.requests.filter((r) => r.url.includes("/api/customer-auth/login")).length;
await page.send("Network.clearBrowserCookies");
await page.goto(`${base}/dang-nhap`);
await setNative("#login-username", username);
await setNative("#login-password", password);
await page.eval(`document.querySelector('form').requestSubmit(); document.querySelector('form').requestSubmit();`);
await sleep(1500);
const afterLoginReqs = page.requests.filter((r) => r.url.includes("/api/customer-auth/login")).length;
record("AUTH double-submit: synchronous double submit sends at most one login request", afterLoginReqs - beforeLoginReqs <= 1, JSON.stringify({ beforeLoginReqs, afterLoginReqs }));

// BFF guards (Node direct; no credentials/token output).
const noOrigin = await fetch(`${base}/api/customer-auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
const evilOrigin = await fetch(`${base}/api/customer-auth/login`, { method: "POST", headers: { "content-type": "application/json", origin: "http://evil.example" }, body: JSON.stringify({ username, password }) });
const wrongType = await fetch(`${base}/api/customer-auth/logout`, { method: "POST", headers: { origin: base, "content-type": "text/plain" }, body: "{}" });
record("AUTH BFF guards: missing/evil Origin and non-JSON POST rejected", noOrigin.status === 403 && evilOrigin.status === 403 && wrongType.status === 415, JSON.stringify({ noOrigin: noOrigin.status, evilOrigin: evilOrigin.status, wrongType: wrongType.status }));


    await emit(t, results);
  });
}, { write: true });

// Migrated regression: profile repeated keyboard focus. All checks emit node:test assertions.
suite("customer", 'profile repeated keyboard focus', () => {
  test('profile repeated keyboard focus', { timeout: 240000 }, async (t) => {
    const { cfg: config } = await import("../lib/config.mjs");
    const { collector, emit } = await import("../lib/browser.mjs");
    const { requireCreds } = await import("../lib/fixtures.mjs");
    const base = config.baseUrl;
    const { results, check: record } = collector();
const { launch } = await import("../lib/browser.mjs");
const browser = await launch(); t.after(() => browser.close());
const BASE_URL = base, customerAcc = requireCreds("CUSTOMER");
  const viewports = [
    { name: "desktop 1440", width: 1440, height: 900 },
    { name: "mobile 390", width: 390, height: 844 },
  ];



  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();

    // 1. Authenticate via keyboard Enter
    await page.goto(`${BASE_URL}/dang-nhap`);
    await page.waitForTimeout(500);
    const userField = page.locator("#login-username");
    await userField.focus();
    await page.keyboard.type(customerAcc.username);

    const passField = page.locator("#login-password");
    await passField.focus();
    await page.keyboard.type(customerAcc.password);

    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500);

    await page.goto(`${BASE_URL}/tai-khoan/thong-tin`);
    await page.waitForTimeout(2000);

    // 2. Open edit profile form
    const editBtn = page.locator('button:has-text("Chỉnh sửa hồ sơ")');
    await editBtn.waitFor({ state: "visible", timeout: 5000 });
    await editBtn.click();

    const phoneInput = page.locator("#acct-phone");
    await phoneInput.waitFor({ state: "visible", timeout: 5000 });
    await phoneInput.fill("0123bad");

    // 3. First invalid submit via keyboard
    // Focus save button and submit via Enter
    const saveBtn = page.locator('button[type="submit"]:has-text("Lưu thay đổi")');
    await saveBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);

    const firstSubmit = await page.evaluate(() => {
      const errP = document.querySelector('form [role="alert"]');
      const active = document.activeElement;
      return {
        isSameAsErrorP: active === errP,
        tagName: active ? active.tagName : null,
        role: active ? active.getAttribute("role") : null,
        hasErrorClass: active ? active.classList.contains("auth-status") : false,
        text: active ? active.textContent : null,
      };
    });

    assert.equal(
      firstSubmit.isSameAsErrorP,
      true,
      `[${vp.name}] First invalid submit must focus error <p role="alert"> directly (got ${firstSubmit.tagName})`,
    );
    assert.equal(firstSubmit.tagName, "P");
    assert.equal(firstSubmit.role, "alert");
    assert.match(firstSubmit.text || "", /Số điện thoại không đúng định dạng/);

    // 4. Tab through form back to Save button (leaving invalid value identical)
    // From error p, tab forward until activeElement is the Save button
    let tabSteps = 0;
    while (tabSteps < 15) {
      await page.keyboard.press("Tab");
      tabSteps++;
      const isSaveBtn = await page.evaluate(() => {
        const active = document.activeElement;
        return active?.tagName === "BUTTON" && active?.getAttribute("type") === "submit";
      });
      if (isSaveBtn) break;
    }

    const onSaveBeforeRepeat = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        tagName: active ? active.tagName : null,
        type: active ? active.getAttribute("type") : null,
        text: active ? active.textContent : null,
      };
    });
    assert.equal(onSaveBeforeRepeat.tagName, "BUTTON", `Must have tabbed to Save button before repeat submit`);
    assert.equal(onSaveBeforeRepeat.type, "submit");

    // 5. Repeat identical invalid submit via keyboard Enter on Save button
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);

    const repeatSubmit = await page.evaluate(() => {
      const errP = document.querySelector('form [role="alert"]');
      const active = document.activeElement;
      return {
        isSameAsErrorP: active === errP,
        tagName: active ? active.tagName : null,
        role: active ? active.getAttribute("role") : null,
        hasErrorClass: active ? active.classList.contains("auth-status") : false,
        text: active ? active.textContent : null,
      };
    });

    assert.equal(
      repeatSubmit.isSameAsErrorP,
      true,
      `[${vp.name}] Repeated identical invalid submit must re-focus error <p role="alert"> (got ${repeatSubmit.tagName})`,
    );
    assert.equal(repeatSubmit.tagName, "P");
    assert.equal(repeatSubmit.role, "alert");
    assert.match(repeatSubmit.text || "", /Số điện thoại không đúng định dạng/);

    // 6. Clean up: cancel edit form
    const cancelBtn = page.locator('button:has-text("Hủy")');
    await cancelBtn.click();
    await page.waitForTimeout(200);

    record(vp.name, true, JSON.stringify({
      viewport: `${vp.width}x${vp.height} (${vp.name})`,
      firstSubmitActiveElement: firstSubmit.tagName,
      firstSubmitIsErrorP: firstSubmit.isSameAsErrorP,
      repeatSubmitActiveElement: repeatSubmit.tagName,
      repeatSubmitIsErrorP: repeatSubmit.isSameAsErrorP,
      status: "PASS",
    }));

    await ctx.close();
  }


    await emit(t, results);
  });
}, { write: false });

// error-focus-contract: keyboard behavior on the four screens, with failed HTTP
// responses intercepted in the browser so no account/cart/order is mutated.
suite("customer", "error keyboard focus", () => {
  test("checkout, AI search, order detail and password errors receive focus", { timeout: 120000 }, async t => {
    const { requireCreds } = await import("../lib/fixtures.mjs");
    const browser = await launch(); t.after(() => browser.close());
    const c = await browser.newContext();
    const identity = { id: 1, username: "focus-fixture", email: "focus@example.invalid", role: "CUSTOMER", status: "ACTIVE", createdAt: "2026-01-01T00:00:00Z", emailVerified: true };
    await c.route("**/api/**", route => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/customer-auth/me") return route.fulfill({ json: { success: true, identity } });
      if (path === "/api/customer-commerce/cart") return route.fulfill({ json: { success: true, result: { cartId: 1, totalItems: 1, subTotal: 100000, items: [{ skuId: 1, productName: "Focus product", quantity: 1, unitPrice: 100000, totalPrice: 100000 }] } } });
      if (path === "/api/customer-profile") return route.fulfill({ json: { success: true, result: { id: 1, firstName: "Focus", lastName: "Test", phoneNumber: "0913000001", address: "14 E2E Street" } } });
      if (path === "/api/customer-commerce/cart/quote") return route.fulfill({ json: { success: true, result: {
        items: [{ skuId: 1, productName: "Focus product", quantity: 1, unitPrice: 100000, totalPrice: 100000, discountAmount: 0, pointsDiscountAmount: 0 }],
        subTotal: 100000, voucherCode: null, voucherDiscount: 0, remainingMerchandiseAmount: 100000,
        redeemedPoints: 0, pointsDiscount: 0, allowedRedeemedPoints: 0, availablePoints: null, policyStatus: "UNCONFIGURED",
        loyaltyPolicyId: null, loyaltyPolicyVersion: null, redeemCurrencyPerPoint: null, merchandiseAmountDue: 100000, quoteFingerprint: "a".repeat(64),
      } } });
      if (path.endsWith('/offers')) return route.fulfill({ json: { success: true, result: [] } });
      if (path.endsWith('/shipping')) return route.fulfill({ json: { success: true, result: { shippingFee: 1000 } } });
      return route.fulfill({ status: 503, json: { success: false, message: "Dịch vụ tạm thời không sẵn sàng." } });
    });
    const page = await c.newPage();
    async function focusedAlert() {
      await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'alert');
      assert.ok(await page.evaluate(() => document.activeElement.textContent.trim().length > 0));
      assert.equal(await page.evaluate(() => document.activeElement.matches(':focus')), true);
    }
    await t.test("order detail load failure", async () => {
      await page.goto(cfg.baseUrl + "/don-hang/1"); await focusedAlert();
    });
    await t.test("AI request failure", async () => {
      await page.goto(cfg.baseUrl + "/tim-kiem-ai");
      await page.locator('#ai-query').fill("focus error");
      await page.locator('.search-submit').focus(); await page.keyboard.press('Enter'); await focusedAlert();
    });
    await t.test("password server failure", async () => {
      await page.goto(cfg.baseUrl + "/tai-khoan/bao-mat");
      const password = requireCreds("CUSTOMER").password;
      await page.locator('#pw-current').fill(password);
      await page.locator('#pw-next').fill(password + "-New1!");
      await page.locator('#pw-confirm').fill(password + "-New1!");
      await page.locator('form button[type="submit"]').focus(); await page.keyboard.press('Enter'); await focusedAlert();
    });
    await t.test("checkout server failure", async () => {
      await page.goto(cfg.baseUrl + "/thanh-toan");
      await page.locator('#checkout-form').waitFor();
      // Profile, shipping and quote are ready before keyboard submission.
      await page.waitForTimeout(800);
      await page.locator('button[form="checkout-form"]').focus(); await page.keyboard.press('Enter');
      await focusedAlert();
      assert.match(await page.evaluate(() => document.activeElement.textContent), /Dịch vụ tạm thời không sẵn sàng/);
    });
  });
});
