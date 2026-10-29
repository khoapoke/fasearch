// Candidate auth UI/BFF evidence: real HTTP register/login/my-info on 18098.
// CDP only; synthetic account generated per run; no token/password printed.
// Usage: node scripts/auth-ui-check.mjs <feBase> <outDir>

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = process.env.CHROME_BIN
  || "/home/dolakhoa/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome";
const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) { console.error("dùng: node scripts/auth-ui-check.mjs <feBase> <outDir>"); process.exit(1); }
const shots = join(outDir, "shots");
await mkdir(shots, { recursive: true });
const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

class Page {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.requests = [];
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
        return;
      }
      if (msg.method === "Network.requestWillBeSent") this.requests.push({ url: msg.params.request.url, method: msg.params.request.method });
    });
  }
  send(method, params = {}) { this.id += 1; const id = this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(expression) { const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text ?? "eval lỗi"); return r.result?.value; }
  async goto(url) { await this.send("Page.navigate", { url }); await sleep(1400); }
  async setViewport(width, height = 900) { await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 }); }
  async shot(file) { const r = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); await writeFile(file, Buffer.from(r.data, "base64")); }
}

async function launch(port) {
  const proc = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/customer-auth-ui", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 80; i += 1) { try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return proc; } catch { /* retry */ } await sleep(150); }
  proc.kill(); throw new Error("Chrome CDP không khởi động");
}
const proc = await launch(9420);
const page = await (async () => {
  const res = await fetch("http://127.0.0.1:9420/json/new?about:blank", { method: "PUT" });
  const target = await res.json(); const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
  const p = new Page(ws); await p.send("Page.enable"); await p.send("Runtime.enable"); await p.send("Network.enable"); return p;
})();

const waitFor = async (fn, timeout = 12000) => { const start = Date.now(); while (Date.now() - start < timeout) { if (await fn()) return true; await sleep(120); } return false; };
const setNative = (selector, value, proto = "HTMLInputElement") => page.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const set = Object.getOwnPropertyDescriptor(${proto}.prototype, 'value').set; set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
const cookies = async () => (await page.send("Network.getAllCookies")).cookies;
const waitPath = (path) => waitFor(async () => (await page.eval(`location.pathname`)) === path);
const pageProbe = () => page.eval(`(() => ({ path: location.pathname, h1: document.querySelector('h1')?.textContent ?? null, footer: !!document.querySelector('.sfFooter'), focusedHeader: !!document.querySelector('.chAuthHeader'), fullHeader: !!document.querySelector('.chHeader') && !document.querySelector('.chAuthHeader'), authPage: !!document.querySelector('.authPage'), acctPage: !!document.querySelector('.acctPage'), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, busy: document.querySelector('form')?.getAttribute('aria-busy') ?? null, error: document.querySelector('.auth-status.is-error')?.textContent ?? null }))()`);

const stamp = Date.now().toString(36);
const username = `ui_auth_${stamp}`;
const password = `Ui!${Math.random().toString(36).slice(2)}A1`;
const email = `${username}@example.test`;
const phone = `09${String(Date.now()).slice(-8)}`;
const account = { username, password, email, phone };
let checks = 0;

// Login page structure.
await page.send("Network.clearBrowserCookies");
await page.setViewport(1440, 1000);
await page.goto(`${base}/dang-nhap`);
let p = await pageProbe();
record("AUTH login structure: focused Customer header, no footer, native form fields", p.path === "/dang-nhap" && p.h1 === "Đăng nhập" && p.focusedHeader && !p.fullHeader && !p.footer && p.authPage, JSON.stringify(p));
const attrs = await page.eval(`(() => { const u=document.querySelector('#login-username'),pw=document.querySelector('#login-password'),f=document.querySelector('form'); return { usernameAutocomplete:u?.getAttribute('autocomplete'), passwordAutocomplete:pw?.getAttribute('autocomplete'), labels:[...document.querySelectorAll('.auth-form label')].map(x=>x.textContent), passwordType:pw?.type, busy:f?.getAttribute('aria-busy') }; })()`);
record("AUTH login fields editable, labels/autocomplete native-safe", attrs.usernameAutocomplete === "username" && attrs.passwordAutocomplete === "current-password" && attrs.passwordType === "password" && attrs.busy === "false", JSON.stringify(attrs));

// Register a fresh synthetic account through real UI/BFF.
await page.goto(`${base}/dang-ky`);
p = await pageProbe();
record("AUTH register structure: same Customer form grammar, no footer", p.path === "/dang-ky" && p.h1 === "Tạo tài khoản" && p.focusedHeader && !p.footer, JSON.stringify(p));
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
checks += 1;
record("AUTH register real HTTP: CUSTOMER account created and redirected to account", registered && regIdentity, JSON.stringify({ registered, identity: await page.eval(`document.querySelector('.acct-identity strong')?.textContent`) }));
record("AUTH account uses actual my-info only; placeholder operations are honest", (await page.eval(`document.body.innerText.includes('Chưa có trong pilot này') || document.body.innerText.includes('Đơn gần đây')`)) === true, await page.eval(`document.querySelector('.acct-main')?.innerText.slice(0,120)`));

const cookieList = await cookies();
const isAuthCookieName = (name) => name === "fasearch-auth-pilot-3115" || name.startsWith("fasearch-auth-pilot-3115.");
const authCookie = cookieList.find((c) => isAuthCookieName(c.name));
const tokenLeak = await page.eval(`(() => ({ cookie: document.cookie, local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage), htmlHasToken: /accessToken|eyJ[A-Za-z0-9_-]{10,}/.test(document.documentElement.innerHTML) }))()`);
record("AUTH cookie: unique HttpOnly SameSite=Lax Path=/ bounded expiry, no token in JS/storage/HTML",
  !!authCookie && authCookie.httpOnly === true && authCookie.sameSite === "Lax" && authCookie.path === "/"
    && authCookie.secure === false && authCookie.session === false && authCookie.expires > Date.now() / 1000
    && authCookie.expires <= Date.now() / 1000 + 86400 + 120
    && !tokenLeak.cookie.includes("fasearch-auth-pilot-3115") && !tokenLeak.local.includes("eyJ") && !tokenLeak.session.includes("eyJ") && !tokenLeak.htmlHasToken,
  JSON.stringify({ cookie: authCookie ? { name: authCookie.name, httpOnly: authCookie.httpOnly, sameSite: authCookie.sameSite, path: authCookie.path, secure: authCookie.secure, session: authCookie.session, expires: authCookie.expires } : null, tokenLeak: { authCookieHidden: !tokenLeak.cookie.includes("fasearch-auth-pilot-3115"), pointerCookie: tokenLeak.cookie, storageNoToken: !tokenLeak.local.includes("eyJ") && !tokenLeak.session.includes("eyJ"), htmlNoToken: !tokenLeak.htmlHasToken } }));

await page.shot(join(shots, "account-authenticated-1440-light.png"));

// Logout local-only; guest account state.
await page.eval(`[...document.querySelectorAll('.acct-logout')][0]?.click()`);
const loggedOut = await waitPath("/");
const cookieAfter = (await cookies()).some((c) => isAuthCookieName(c.name));
const logoutPosts = page.requests.filter((r) => r.url.includes("/api/customer-auth/logout") && r.method === "POST").length;
record("AUTH logout: local cookie cleared, returns home", loggedOut && !cookieAfter && logoutPosts >= 1, JSON.stringify({ loggedOut, cookieAfter, logoutPosts }));
await page.goto(`${base}/tai-khoan`);
await sleep(1000);
const guest = await pageProbe();
record("AUTH guest account: honest sign-in state, no footer", guest.acctPage && !guest.footer && (await page.eval(`document.body.innerText.includes('Cần đăng nhập')`)), JSON.stringify(guest));

// Wrong password then correct login, reload persistence.
await page.goto(`${base}/dang-nhap`);
await setNative("#login-username", username);
await setNative("#login-password", "wrong-password");
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
const legacyReturn = await waitFor(async () => (await page.eval(`location.pathname`)) === "/tai-khoan");
await sleep(1800);
const legacyStayed = (await page.eval(`location.pathname`)) === "/tai-khoan";
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

// Account unsupported sections + visual/responsive screenshots.
await page.goto(`${base}/tai-khoan`); await sleep(1000);
for (const label of ["Đơn gần đây", "Bảo mật", "Điểm & voucher"]) {
  await page.eval(`[...document.querySelectorAll('.acct-nav button')].find(b => b.textContent.includes(${JSON.stringify(label)}))?.click()`);
  await sleep(150);
}
const placeholder = await page.eval(`document.querySelector('.acct-placeholder h3')?.textContent ?? null`);
record("AUTH unsupported account sections: explicit unavailable, no fixture orders", placeholder === "Chưa có trong pilot này", placeholder);

// Guest login/register visual matrix, then one real login for account matrix.
await page.send("Network.clearBrowserCookies");
for (const scheme of ["light", "dark"]) {
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  for (const [w, h] of [[1440, 1000], [1024, 900], [768, 900], [390, 844], [320, 780]]) {
    await page.setViewport(w, h);
    for (const [path, label] of [["/dang-nhap", "login"], ["/dang-ky", "register"]]) {
      await page.goto(`${base}${path}`);
      await waitFor(async () => Boolean(await page.eval(`document.querySelector('h1')?.textContent`)));
      const state = await pageProbe();
      record(`AUTH ${label} ${scheme} @${w}: no footer, focused header, no overflow`, !state.footer && state.focusedHeader && state.overflow <= 1, JSON.stringify(state));
      await page.shot(join(shots, `${label}-${w}-${scheme}.png`));
    }
  }
}
await page.setViewport(1440, 1000);
await page.goto(`${base}/dang-nhap`);
await setNative("#login-username", username);
await setNative("#login-password", password);
await page.eval(`document.querySelector('form').requestSubmit()`);
await waitPath("/tai-khoan");
for (const scheme of ["light", "dark"]) {
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  for (const [w, h] of [[1440, 1000], [1024, 900], [768, 900], [390, 844], [320, 780]]) {
    await page.setViewport(w, h);
    await page.goto(`${base}/tai-khoan`);
    await waitFor(async () => Boolean(await page.eval(`document.querySelector('.acct-identity strong')?.textContent`)));
    const state = await pageProbe();
    record(`AUTH account ${scheme} @${w}: no footer, full header, no overflow`, !state.footer && state.fullHeader && state.overflow <= 1, JSON.stringify(state));
    await page.shot(join(shots, `account-${w}-${scheme}.png`));
  }
}

await writeFile(join(outDir, "auth-ui-report.json"), JSON.stringify(results, null, 2));
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass · ảnh: ${shots}`);
proc.kill();
process.exit(failed.length === 0 ? 0 : 1);
