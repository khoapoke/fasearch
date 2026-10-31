// Browser evidence for the Customer catalog → detail pilot (FE 3113, BE 18097).
// CDP only; no new dependency, no writes. Usage: node scripts/catalog-ui-check.mjs <baseUrl> <outDir>

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = process.env.CHROME_BIN
  || "/home/dolakhoa/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome";
const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) {
  console.error("dùng: node scripts/catalog-ui-check.mjs <baseUrl> <outDir>");
  process.exit(1);
}
const shots = join(outDir, "shots");
await mkdir(shots, { recursive: true });

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

class Page {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.requests = [];
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
      if (msg.method === "Network.requestWillBeSent") {
        this.requests.push({ url: msg.params.request.url, method: msg.params.request.method });
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
    await sleep(1600);
  }
  async setViewport(width, height = 900) {
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  }
  async shot(file) {
    const r = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(file, Buffer.from(r.data, "base64"));
  }
  posts() { return this.requests.filter((r) => r.method !== "GET"); }
}

async function launch(port, profile) {
  const proc = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
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

const proc = await launch(9414, "/tmp/catalog-ui");
const page = await (async () => {
  const res = await fetch("http://127.0.0.1:9414/json/new?about:blank", { method: "PUT" });
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

const waitFor = async (fn, timeout = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return true;
    await sleep(120);
  }
  return false;
};
const cards = () => page.eval(`document.querySelectorAll('.cat-product-card').length`);
const countText = () => page.eval(`document.querySelector('.cat-result-count')?.textContent ?? ""`);
const waitCards = (n) => waitFor(async () => (await cards()) === n);
const setNative = (selector, value, proto = "HTMLInputElement") => page.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const set = Object.getOwnPropertyDescriptor(${proto}.prototype, 'value').set; set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);

await page.setViewport(1440, 1000);
await page.goto(`${base}/nam`);
const listingLoaded = await waitCards(6);

const initial = await page.eval(`(() => {
  const q = (s) => document.querySelector(s);
  return {
    heading: q('.cat-head h1')?.textContent,
    count: q('.cat-result-count')?.textContent,
    cards: document.querySelectorAll('.cat-product-card').length,
    categories: [...document.querySelectorAll('.cat-filter-desktop .cat-filter-option span')].map((x) => x.textContent),
    pagination: !!q('.cat-pagination'),
    sort: q('#listing-sort')?.value,
    header: !!q('.chHeader'),
    productCurrent: q('.chNav a[href="/nam"]')?.getAttribute('aria-current'),
    oldPilot: !!q('.pCard, .sfHeader'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    imageFail: document.querySelectorAll('.cat-image-fail').length,
    prices: [...document.querySelectorAll('.cat-product-price')].map((x) => x.textContent),
  };
})()`);
record("LISTING initial: real 12 products, 6/page, categories BE, header active Sản phẩm",
  listingLoaded && initial.cards === 6 && /12 sản phẩm/.test(initial.count) && initial.categories.includes("Áo Khoác")
    && initial.pagination && initial.sort === "id,desc" && initial.header && initial.productCurrent === "page"
    && !initial.oldPilot && initial.overflow <= 1,
  JSON.stringify(initial));
await page.shot(join(shots, "listing-1440-light.png"));

// Category filter (real server query).
await page.eval(`(() => { const labels = [...document.querySelectorAll('.cat-filter-desktop .cat-filter-option')]; labels.find((l) => l.textContent.includes('Áo Khoác'))?.querySelector('input')?.click(); })()`);
const categoryOk = await waitCards(2);
const categoryState = await page.eval(`({ count: document.querySelector('.cat-result-count')?.textContent, cards: document.querySelectorAll('.cat-product-card').length, names: [...document.querySelectorAll('.cat-product-name')].map((x) => x.textContent) })`);
const categoryRequest = page.requests.some((r) => r.url.includes("/api/catalog/products") && r.url.includes("categoryId=3"));
record("LISTING category: Áo Khoác lọc thật qua server (2 sản phẩm)",
  categoryOk && categoryState.cards === 2 && categoryRequest && categoryState.names.every((n) => n.includes("Áo Khoác")),
  JSON.stringify({ categoryState, categoryRequest }));

// Reset then sort price asc.
await page.eval(`document.querySelector('.cat-filter-desktop .cat-filter-reset')?.click()`);
await waitCards(6);
await setNative("#listing-sort", "price,asc", "HTMLSelectElement");
const sortedOk = await waitFor(async () => (await page.eval(`document.querySelector('.cat-product-price')?.textContent`))?.startsWith("150.000"));
const sortedState = await page.eval(`({ first: document.querySelector('.cat-product-price')?.textContent, prices: [...document.querySelectorAll('.cat-product-price')].map((x) => x.textContent) })`);
record("LISTING sort: giá thấp→cao do server trả đúng thứ tự", sortedOk && sortedState.first === "150.000 ₫", JSON.stringify(sortedState));

// Price filter + apply.
await setNative("#desktop-min", "300000");
await setNative("#desktop-max", "500000");
await page.eval(`document.querySelector('.cat-filter-desktop .cat-filter-apply')?.click()`);
const priceOk = await waitFor(async () => /4 sản phẩm/.test(await countText()));
const priceState = await page.eval(`({ count: document.querySelector('.cat-result-count')?.textContent, cards: document.querySelectorAll('.cat-product-card').length })`);
record("LISTING price filter: 300k–500k qua server trả 4 sản phẩm", priceOk && priceState.cards === 4, JSON.stringify(priceState));

// Keyword filter.
await page.eval(`document.querySelector('.cat-filter-desktop .cat-filter-reset')?.click()`);
await waitCards(6);
await setNative("#desktop-keyword", "áo");
await page.eval(`document.querySelector('.cat-filter-desktop .cat-filter-apply')?.click()`);
const keywordOk = await waitFor(async () => /6 sản phẩm/.test(await countText()));
const keywordState = await page.eval(`({ count: document.querySelector('.cat-result-count')?.textContent, names: [...document.querySelectorAll('.cat-product-name')].map((x) => x.textContent) })`);
record("LISTING keyword: “áo” lọc thật theo tên", keywordOk && keywordState.names.length === 6, JSON.stringify(keywordState));

// Pagination.
await page.eval(`document.querySelector('.cat-filter-desktop .cat-filter-reset')?.click()`);
await waitCards(6);
await page.eval(`[...document.querySelectorAll('.cat-pagination button')].find((b) => b.textContent.includes('Trang sau'))?.click()`);
const page2Ok = await waitFor(async () => (await page.eval(`document.querySelector('.cat-pagination span')?.textContent`)) === "Trang 2/2");
const page2Request = page.requests.some((r) => r.url.includes("/api/catalog/products") && r.url.includes("page=1"));
record("LISTING pagination: trang 2 gọi server page=1", page2Ok && page2Request && (await cards()) === 6, JSON.stringify({ page2Ok, page2Request }));

// Empty state.
await page.eval(`document.querySelector('.cat-filter-desktop .cat-filter-reset')?.click()`);
await waitCards(6);
await setNative("#desktop-keyword", "zzzz");
await page.eval(`document.querySelector('.cat-filter-desktop .cat-filter-apply')?.click()`);
const emptyOk = await waitFor(async () => (await page.eval(`!!document.querySelector('.cat-empty')`)) === true);
record("LISTING empty state: không có kết quả + reset", emptyOk && /Không có sản phẩm/.test(await page.eval(`document.querySelector('.cat-empty h2')?.textContent ?? ""`)), await countText());
await page.eval(`document.querySelector('.cat-empty .cat-text-button')?.click()`);
await waitCards(6);

// Error state using blocked catalog products API, then retry.
await page.send("Network.setBlockedURLs", { urls: ["*api/catalog/products*"] });
await page.goto(`${base}/nam`);
const errorOk = await waitFor(async () => (await page.eval(`!!document.querySelector('.cat-status.cat-error')`)) === true);
await page.send("Network.setBlockedURLs", { urls: [] });
const errorText = await page.eval(`document.querySelector('.cat-status.cat-error')?.textContent ?? ""`);
await page.eval(`document.querySelector('.cat-status.cat-error .cat-text-button')?.click()`);
const recovered = await waitCards(6);
record("LISTING error/retry: lỗi mạng hiện trạng thái thật, thử lại tải được", errorOk && recovered, JSON.stringify({ errorText: errorText.slice(0, 80), recovered }));
await page.shot(join(shots, "listing-error-1440-light.png"));

// Image failure state.
await page.send("Network.setBlockedURLs", { urls: ["*images.unsplash.com*"] });
await page.goto(`${base}/nam`);
const imageFailOk = await waitFor(async () => (await page.eval(`document.querySelectorAll('.cat-image-fail').length`)) > 0);
const failCount = await page.eval(`document.querySelectorAll('.cat-image-fail').length`);
await page.send("Network.setBlockedURLs", { urls: [] });
record("LISTING image failure: placeholder rõ ràng, không giả ảnh", imageFailOk && failCount > 0, `fail=${failCount}`);

// Detail + variants + zoom.
await page.setViewport(1440, 1000);
await page.goto(`${base}/nam`);
await waitCards(6);
await page.eval(`(() => { const link = [...document.querySelectorAll('.cat-product-name')].find((a) => a.textContent.includes('Áo Khoác Bomber Đen')); link?.click(); })()`);
await sleep(1500);
const detail = await page.eval(`(() => { const q = (s) => document.querySelector(s); return {
  path: location.pathname, title: q('.cat-detail-info h1')?.textContent, price: q('.cat-detail-price')?.textContent,
  colors: [...document.querySelectorAll('.cat-option-block')][0] ? [...document.querySelectorAll('.cat-option-block')][0].querySelectorAll('.cat-option-chip').length : 0,
  sizes: [...document.querySelectorAll('.cat-option-block')][1] ? [...document.querySelectorAll('.cat-option-block')][1].querySelectorAll('.cat-option-chip').length : 0,
  addDisabled: q('.cat-buy-row button.cat-primary')?.disabled ?? null, image: !!q('.cat-detail-image'),
  productCurrent: q('.chNav a[href="/nam"]')?.getAttribute('aria-current'), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}; })()`);
record("DETAIL real product: variants màu/cỡ, giá, read-only Add, header active",
  /^\/san-pham\/\d+$/.test(detail.path) && detail.title === "Áo Khoác Bomber Đen" && detail.colors === 2 && detail.sizes >= 1
    && detail.addDisabled === true && detail.image && detail.productCurrent === "page" && detail.overflow <= 1,
  JSON.stringify(detail));
await page.shot(join(shots, "detail-1440-light.png"));

const initialPrice = detail.price;
await page.eval(`(() => { const chips = [...document.querySelectorAll('.cat-option-block')][0]?.querySelectorAll('.cat-option-chip'); const next = [...chips].find((c) => c.getAttribute('aria-pressed') !== 'true'); next?.click(); })()`);
await sleep(300);
const variantState = await page.eval(`(() => ({ price: document.querySelector('.cat-detail-price')?.textContent, color: [...document.querySelectorAll('.cat-option-block')][0]?.querySelector('h2 span')?.textContent }))()`);
const expectedPrice = variantState.color === "Đen" ? "579.000 ₫" : variantState.color === "Xám" ? "589.000 ₫" : null;
record("DETAIL variant: đổi màu cập nhật giá theo base + additionalPrice", initialPrice !== variantState.price && variantState.price === expectedPrice, JSON.stringify({ initialPrice, variantState, expectedPrice }));

await page.eval(`document.querySelector('.cat-detail-image-button')?.focus()`);
await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r" });
await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
await sleep(250);
const zoom = await page.eval(`(() => ({ open: document.querySelector('.cat-dialog')?.open, img: !!document.querySelector('.cat-dialog-media img'), caption: document.querySelector('.cat-dialog-caption')?.textContent?.slice(0, 60) }))()`);
await page.shot(join(shots, "detail-zoom-1440-light.png"));
await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
await sleep(250);
const zoomClosed = await page.eval(`(() => ({ open: document.querySelector('.cat-dialog')?.open, returned: document.activeElement === document.querySelector('.cat-detail-image-button') }))()`);
record("DETAIL zoom: Enter mở đúng ảnh, Escape đóng + trả focus", zoom.open && zoom.img && !zoomClosed.open && zoomClosed.returned, JSON.stringify({ zoom, zoomClosed }));

// 404 detail.
await page.goto(`${base}/san-pham/999999`);
await sleep(1200);
const notFound = await page.eval(`({ text: document.querySelector('.cat-empty h2')?.textContent ?? "", body: document.body.innerText.includes('Không tìm thấy sản phẩm') })`);
record("DETAIL 404: trạng thái thật + lối về danh sách", notFound.body, JSON.stringify(notFound));
await page.shot(join(shots, "detail-404-1440-light.png"));

// Responsive/theme screenshots + overflow.
for (const scheme of ["light", "dark"]) {
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  for (const [w, h] of [[1440, 1000], [1024, 900], [768, 900], [390, 844], [320, 780]]) {
    await page.setViewport(w, h);
    await page.goto(`${base}/nam`);
    await waitCards(6);
    const state = await page.eval(`({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, cards: document.querySelectorAll('.cat-product-card').length, cols: getComputedStyle(document.querySelector('.cat-product-grid')).gridTemplateColumns.split(' ').length, theme: document.documentElement.getAttribute('data-theme') })`);
    record(`LISTING ${scheme} @${w}: không tràn, grid responsive, theme đúng`, state.overflow <= 1 && state.theme === scheme && (w <= 760 || state.cols >= 2), JSON.stringify(state));
    await page.shot(join(shots, `listing-${w}-${scheme}.png`));

    await page.goto(`${base}/san-pham/9`);
    await waitFor(async () => Boolean(await page.eval(`document.querySelector('.cat-detail-info h1')?.textContent`)));
    const detailState = await page.eval(`({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, title: document.querySelector('.cat-detail-info h1')?.textContent, addDisabled: document.querySelector('.cat-buy-row button.cat-primary')?.disabled ?? null, theme: document.documentElement.getAttribute('data-theme'), layout: getComputedStyle(document.querySelector('.cat-detail-layout')).gridTemplateColumns.split(' ').length })`);
    record(`DETAIL ${scheme} @${w}: không tràn, read-only add, layout responsive`, detailState.overflow <= 1 && detailState.theme === scheme && detailState.addDisabled === true && (w > 760 ? detailState.layout >= 2 : detailState.layout === 1), JSON.stringify(detailState));
    await page.shot(join(shots, `detail-${w}-${scheme}.png`));
  }
}

// Header menu keyboard (inherited Customer header).
await page.setViewport(390, 844);
await page.goto(`${base}/nam`);
await page.eval(`document.querySelector('.chMobile > summary')?.focus()`);
await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r" });
await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
await sleep(220);
const menuOpen = await page.eval(`({ open: document.querySelector('.chMobile')?.open, current: document.querySelector('.chMobile a[href="/nam"]')?.getAttribute('aria-current') })`);
await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
await sleep(200);
const menuClosed = await page.eval(`document.querySelector('.chMobile')?.open`);
record("HEADER menu: Enter mở/current Sản phẩm, Escape đóng", menuOpen.open === true && menuOpen.current === "page" && menuClosed === false, JSON.stringify({ menuOpen, menuClosed }));

// Home/AI isolation.
await page.setViewport(1440, 1000);
for (const [label, path, check] of [
  ["Home", "/", "hmHome"],
  ["AI", "/tim-kiem-ai", "aiPage"],
]) {
  await page.goto(`${base}${path}`);
  const iso = await page.eval(`({ cat: !!document.querySelector('.catPage'), marker: !!document.querySelector('.${check}'), header: !!document.querySelector('.chHeader') })`);
  record(`${label} isolation: candidate Home/AI giữ nguyên, không lẫn catalog`, iso.header && iso.marker && !iso.cat, JSON.stringify(iso));
}

record("No writes: toàn bộ request là GET", page.posts().length === 0, JSON.stringify(page.posts().slice(0, 3)));

await writeFile(join(outDir, "catalog-ui-report.json"), JSON.stringify(results, null, 2));
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass · ảnh: ${shots}`);
proc.kill();
process.exit(failed.length === 0 ? 0 : 1);
