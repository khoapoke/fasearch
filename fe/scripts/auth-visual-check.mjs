// Focused visual/canvas regression for REVIEW-AUTH-VISUAL-03.
// Usage: node scripts/auth-visual-check.mjs <feBase> <outDir>
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:3115";
const outDir = process.argv[3];
if (!process.argv[3]) { console.error("dùng: node scripts/auth-visual-check.mjs <feBase> <outDir>"); process.exit(1); }
mkdirSync(join(outDir, "shots"), { recursive: true });
const chrome = "/home/dolakhoa/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome";
const port = 9592;
const proc = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/customer-auth-visual", "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(150); }
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
let nextId = 0; const pending = new Map();
ws.addEventListener("message", (event) => { const msg = JSON.parse(event.data); if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); } });
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;
const shot = async (name) => { const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); writeFileSync(join(outDir, "shots", name), Buffer.from(data, "base64")); };
const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "OK  " : "FAIL"} ${name} — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); };
async function viewport(w, h) { await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w <= 760 }); }
async function go(path) { await send("Page.navigate", { url: `${base}${path}` }); await sleep(900); }
const measure = () => evaluate(`(() => {
  const q = (s) => document.querySelector(s);
  const style = (s) => { const e = q(s); return e ? getComputedStyle(e) : null; };
  const box = (s) => { const e = q(s); if (!e) return null; const b = e.getBoundingClientRect(); return { width: +b.width.toFixed(2), height: +b.height.toFixed(2), top: +b.top.toFixed(2), left: +b.left.toFixed(2) }; };
  const layer = q('.authThreadline'); const line = q('.authThreadline .threadline'); const layerRect = layer?.getBoundingClientRect(); const layoutRect = q('.authPage .auth-layout')?.getBoundingClientRect();
  const h1 = q('.authPage .auth-form h1'); const h2 = q('.acct-section-head h2'); const nav = q('.acct-nav button');
  return {
    path: location.pathname,
    fieldMargin: style('.authPage .auth-field')?.marginBottom ?? null,
    rule: style('.authPage .auth-rule')?.display ?? null,
    layoutGap: style('.authPage .auth-layout')?.gap ?? null,
    editorialHeight: box('.authPage .auth-editorial')?.height ?? null,
    photoMargin: style('.authPage .auth-photo')?.marginLeft ?? null,
    contentBottom: style('.authPage .auth-content')?.paddingBottom ?? null,
    h1: h1 ? { fontSize: getComputedStyle(h1).fontSize, marginBottom: getComputedStyle(h1).marginBottom, letterSpacing: getComputedStyle(h1).letterSpacing, lineHeight: getComputedStyle(h1).lineHeight } : null,
    accountH2: h2 ? { fontSize: getComputedStyle(h2).fontSize, marginBottom: getComputedStyle(h2).marginBottom, letterSpacing: getComputedStyle(h2).letterSpacing } : null,
    accountNav: nav ? { height: +nav.getBoundingClientRect().height.toFixed(2), lineHeight: getComputedStyle(nav).lineHeight } : null,
    canvas: layer ? { fit: layer.dataset.fit ?? null, reason: layer.dataset.reason ?? null, display: getComputedStyle(layer).display, lineDisplay: line ? getComputedStyle(line).display : null, line: box('.authThreadline .threadline'), layerRect: layerRect ? { top: +layerRect.top.toFixed(2), bottom: +layerRect.bottom.toFixed(2), height: +layerRect.height.toFixed(2) } : null, layoutRect: layoutRect ? { top: +layoutRect.top.toFixed(2), bottom: +layoutRect.bottom.toFixed(2) } : null, vars: { top: getComputedStyle(layer).getPropertyValue('--thread-top'), width: getComputedStyle(layer).getPropertyValue('--thread-width') }, pointerEvents: getComputedStyle(layer).pointerEvents, ariaHidden: layer.getAttribute('aria-hidden') } : null,
    footer: !!q('.sfFooter'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
})()`);
async function login() {
  const user = JSON.stringify(process.env.AUTH_VISUAL_USER ?? "");
  const pass = JSON.stringify(process.env.AUTH_VISUAL_PASS ?? "");
  await pageEval(`(() => {
    const set = (selector, value) => { const el = document.querySelector(selector); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('#login-username', ${user}); set('#login-password', ${pass}); document.querySelector('form').requestSubmit();
  })()`);
  for (let i = 0; i < 30; i++) { if (await evaluate(`location.pathname`) === "/tai-khoan" && await evaluate(`!!document.querySelector('.acct-identity strong')`)) return true; await sleep(200); }
  return false;
}
const pageEval = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;
await send("Page.enable"); await send("Runtime.enable");

await send("Network.clearBrowserCookies");
for (const [w, h] of [[1440, 1000], [1024, 1000], [768, 1000], [390, 844], [320, 780]]) {
  await viewport(w, h); await go("/dang-nhap");
  const m = await measure();
  const desktop = w > 760;
  const expectedGap = w <= 900 ? "22px" : w <= 1100 ? "26px" : "46px";
  const expectedHeight = w <= 1100 && w > 760 ? "570px" : "610px";
  const expectedH1 = w <= 760 ? { fontSize: "42px", marginBottom: "12px", lineHeight: "45.36px" } : null;
  const h1ok = !expectedH1 || (m.h1?.fontSize === expectedH1.fontSize && m.h1?.marginBottom === expectedH1.marginBottom && m.h1?.lineHeight === expectedH1.lineHeight);
  const canvasOk = desktop ? (m.canvas?.fit === "visible" && m.canvas?.lineDisplay === "block" && m.canvas?.line?.width > 0 && m.canvas?.line?.height > 0) : (m.canvas?.fit === "none" && m.canvas?.display === "none");
  const editorialOk = !desktop || m.editorialHeight === Number(expectedHeight.replace("px", ""));
  const photoOk = !desktop || m.photoMargin === (w <= 900 ? "-20px" : "-26px");
  record(`VISUAL login ${w}: cascade values`, m.fieldMargin === "18px" && m.rule === "none" && m.layoutGap === expectedGap && editorialOk && photoOk && h1ok && m.contentBottom === (w <= 760 ? "48px" : "72px"), m);
  record(`VISUAL login ${w}: B2 canvas free-space gating`, canvasOk, m.canvas);
  record(`VISUAL login ${w}: no footer/overflow; pointer-safe canvas`, !m.footer && m.overflow <= 1 && (!m.canvas || (m.canvas.pointerEvents === "none" && m.canvas.ariaHidden === "true")), { footer: m.footer, overflow: m.overflow });
  await shot(`login-${w}.png`);
}
await send("Network.clearBrowserCookies");
await viewport(1440, 1000); await go("/dang-nhap"); const authed = await login();
const authedPath = await evaluate(`location.pathname`);
record("VISUAL account reachable for clean-canvas check", authed && authedPath === "/tai-khoan", authedPath);
for (const [w, h] of [[1440, 1000], [390, 844]]) {
  await viewport(w, h); await go("/tai-khoan"); await sleep(900);
  const m = await measure();
  record(`VISUAL account ${w}: clean canvas and final h2/nav`, !m.footer && m.overflow <= 1 && (m.canvas === null) && m.accountH2?.marginBottom === "4px" && m.accountH2?.letterSpacing === "-0.44px" && m.accountH2?.fontSize === "22px" && (w > 760 || Math.abs((m.accountNav?.height ?? 0) - 39.6875) <= 0.02), m);
  await shot(`account-${w}.png`);
}
writeFileSync(join(outDir, "auth-visual-report.json"), JSON.stringify(results, null, 2));
proc.kill();
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);
