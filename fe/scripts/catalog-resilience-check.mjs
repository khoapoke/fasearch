// Malformed-response + category-retry regression via CDP Fetch interception.
// No backend writes/inference; HTTP200 malformed payload is synthetic only.
// Usage: node scripts/catalog-resilience-check.mjs <baseUrl> <outDir>

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = process.env.CHROME_BIN
  || "/home/dolakhoa/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome";
const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) {
  console.error("dùng: node scripts/catalog-resilience-check.mjs <baseUrl> <outDir>");
  process.exit(1);
}
await mkdir(outDir, { recursive: true });
const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};

class Page {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
        return;
      }
      const handler = this.events.get(msg.method);
      if (handler) handler(msg.params);
    });
  }
  on(method, fn) { this.events.set(method, fn); }
  send(method, params = {}) {
    this.id += 1;
    const id = this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text ?? "eval lỗi");
    return r.result?.value;
  }
  async goto(url) {
    await this.send("Page.navigate", { url });
    await sleep(1500);
  }
}

async function launch(port) {
  const proc = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/catalog-resilience", "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 80; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return proc;
    } catch { /* retry */ }
    await sleep(150);
  }
  proc.kill();
  throw new Error("Chrome CDP không khởi động");
}

const proc = await launch(9416);
const page = await (async () => {
  const res = await fetch("http://127.0.0.1:9416/json/new?about:blank", { method: "PUT" });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const p = new Page(ws);
  await p.send("Page.enable");
  await p.send("Runtime.enable");
  await p.send("Network.enable");
  return p;
})();

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
await waitFor(async () => /6 sản phẩm/.test(await page.eval(`document.querySelector('.cat-result-count')?.textContent ?? ""`)));
categoryPhase = "ok";
await page.eval(`[...document.querySelectorAll('.cat-filter-desktop button')].find((b) => b.textContent.includes('Thử lại danh mục'))?.click()`);
const catRecovered = await waitFor(async () => (await page.eval(`document.querySelectorAll('.cat-filter-desktop .cat-filter-option input').length`)) >= 5);
const catAfter = await page.eval(`(() => ({
  options: [...document.querySelectorAll('.cat-filter-desktop .cat-filter-option span')].map((x) => x.textContent),
  error: document.querySelector('.cat-filter-desktop .cat-filter-note[role="alert"]')?.textContent ?? null,
  keyword: document.querySelector('#desktop-keyword')?.value,
  count: document.querySelector('.cat-result-count')?.textContent,
  categoryRequests: ${categoryRequests + 0},
}))()`);
record("CATEGORY 503: lỗi danh mục có nút retry, product list vẫn thật; retry phục hồi tại chỗ giữ filter",
  catFail.options.length === 1 && catFail.retry && /Danh mục/.test(catFail.error) && catFail.cards === 6
    && catRecovered && catAfter.options.length >= 5 && !catAfter.error && catAfter.keyword === "áo" && /6 sản phẩm/.test(catAfter.count),
  JSON.stringify({ catFail, catRecovered, catAfter, categoryRequests }));

// 2) HTTP200 missing required price: error, never invented 0 ₫ or empty success.
productPhase = "missing-price";
await page.goto(`${base}/nam`);
const malformed = await waitFor(async () => (await page.eval(`!!document.querySelector('.cat-status.cat-error')`)) === true);
const malformedState = await page.eval(`(() => ({
  cards: document.querySelectorAll('.cat-product-card').length,
  zero: document.body.innerText.includes("0 ₫"),
  error: document.querySelector('.cat-status.cat-error')?.textContent?.slice(0, 90) ?? "",
  retry: [...document.querySelectorAll('.cat-status.cat-error button')].some((b) => b.textContent.includes('Thử lại')),
}))()`);
record("PRICE malformed HTTP200: thiếu price bị từ chối, không hiện 0 ₫/empty success",
  malformed && malformedState.cards === 0 && malformedState.zero === false && /không hợp lệ|Thử lại/.test(malformedState.error) && malformedState.retry,
  JSON.stringify(malformedState));

// 3) Valid price 0 is preserved (not conflated with missing price).
productPhase = "zero-price";
await page.eval(`[...document.querySelectorAll('.cat-status.cat-error button')].find((b) => b.textContent.includes('Thử lại'))?.click()`);
const zeroOk = await waitFor(async () => (await page.eval(`document.querySelector('.cat-product-price')?.textContent`)) === "0 ₫");
const zeroState = await page.eval(`({ firstPrice: document.querySelector('.cat-product-price')?.textContent, error: !!document.querySelector('.cat-status.cat-error') })`);
record("PRICE 0 hợp lệ vẫn hiển thị 0 ₫ (không bị coi là lỗi)", zeroOk && zeroState.firstPrice === "0 ₫" && !zeroState.error, JSON.stringify(zeroState));

await writeFile(join(outDir, "catalog-resilience-report.json"), JSON.stringify(results, null, 2));
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
proc.kill();
process.exit(failed.length === 0 ? 0 : 1);
