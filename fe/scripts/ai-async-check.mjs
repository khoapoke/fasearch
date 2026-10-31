// Async-boundary regression cho AI search — browser interception (CDP Fetch),
// không gọi inference/BE thật, không ghi dữ liệu.
// Dùng: node scripts/ai-async-check.mjs <baseUrl> <outDir>

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = process.env.CHROME_BIN
  || "/home/dolakhoa/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome";
const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) {
  console.error("dùng: node scripts/ai-async-check.mjs <baseUrl> <outDir>");
  process.exit(1);
}
await mkdir(outDir, { recursive: true });

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
    await sleep(1200);
  }
  async setViewport(width, height = 900) {
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  }
  async setFile(selector, path) {
    const doc = await this.send("DOM.getDocument", { depth: 1 });
    const node = await this.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector });
    await this.send("DOM.setFileInputFiles", { files: [path], nodeId: node.nodeId });
    await sleep(300);
  }
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

const IDENTITY = { success: true, code: 200, message: "", result: { id: 1, username: "reviewer", email: "review@example.test", role: "CUSTOMER", authenticated: true } };
const CSRF = { success: true, code: 200, message: "", result: { headerName: "X-CSRF-TOKEN", token: "browser-interception-only" } };
const oldText = { success: true, code: 200, message: "", result: { results: [{ sourceId: "old-text", score: 0.901, fileName: "old.jpg", imageUrl: null }] } };
const imageOk = { success: true, code: 200, message: "", result: { results: [{ sourceId: "img-1", score: 0.77, fileName: "img.jpg", imageUrl: null }] } };
const composedOk = { success: true, code: 200, message: "", result: { results: [{ sourceId: "mix-1", score: 0.66, fileName: "mix.jpg", imageUrl: null }] } };

const proc = await launch(9413, "/tmp/ai-async");
const page = await (async () => {
  const res = await fetch("http://127.0.0.1:9413/json/new?about:blank", { method: "PUT" });
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
  await p.send("DOM.enable");
  return p;
})();

const fixtures = await mkdtemp(join(tmpdir(), "ai-async-fixtures-"));
const png = join(fixtures, "review.png");
await writeFile(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64"));

const held = [];
const csrfHeld = [];
let holdCsrf = false;
let searchSeen = 0;
function jsonBody(value) { return Buffer.from(JSON.stringify(value)).toString("base64"); }
async function fulfill(requestId, value) {
  await page.send("Fetch.fulfillRequest", {
    requestId,
    responseCode: 200,
    responseHeaders: [{ name: "content-type", value: "application/json" }],
    body: jsonBody(value),
  });
}

page.on("Fetch.requestPaused", async (params) => {
  try {
    const url = params.request.url;
    if (url.includes("/api/auth/me")) return await fulfill(params.requestId, IDENTITY);
    if (url.includes("/api/auth/csrf")) {
      if (holdCsrf) {
        csrfHeld.push(params.requestId);
        return;
      }
      return await fulfill(params.requestId, CSRF);
    }
    if (url.includes("/api/be/v1/ai/search/")) {
      searchSeen += 1;
      held.push({ requestId: params.requestId, url, headers: params.request.headers, postData: params.request.postData ?? "" });
      return;
    }
    await page.send("Fetch.continueRequest", { requestId: params.requestId });
  } catch {
    /* request đã bị abort/đóng */
  }
});

await page.send("Fetch.enable", {
  patterns: [
    { urlPattern: "*api/auth/me*" },
    { urlPattern: "*api/auth/csrf*" },
    { urlPattern: "*api/be/v1/ai/search/*" },
  ],
});
await page.setViewport(1440, 1000);

const waitFor = async (fn, timeout = 6000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return true;
    await sleep(100);
  }
  return false;
};
const ready = () => waitFor(() => page.eval(`(() => { const s = document.querySelector('.search-submit'); return !!s && !s.disabled; })()`));
const setQuery = (value) => page.eval(`(() => { const t = document.querySelector('#ai-query'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, ${JSON.stringify(value)}); t.dispatchEvent(new Event('input', { bubbles: true })); return t.value; })()`);
const submitTwice = () => page.eval(`(() => { const f = document.querySelector('form.search-form'); f.requestSubmit(); f.requestSubmit(); return true; })()`);

// 1) Stale after mode switch: hold text search, switch to Ảnh, then release old JSON.
await page.goto(`${base}/tim-kiem-ai`);
await ready();
await setQuery("áo cũ");
held.length = 0;
await page.eval(`document.querySelector('form.search-form').requestSubmit()`);
const heldText = await waitFor(() => held.length === 1);
const textReq = held[0];
const textHeader = Object.entries(textReq?.headers ?? {}).find(([k]) => k.toLowerCase() === "x-csrf-token")?.[1];
const textType = Object.entries(textReq?.headers ?? {}).find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "";
record("beWrite signal: text vẫn gửi CSRF + JSON {query,limit} như cũ",
  textHeader === "browser-interception-only" && textType.includes("application/json")
    && (textReq?.postData ?? "").includes('"query":"áo cũ"') && (textReq?.postData ?? "").includes('"limit":5'),
  JSON.stringify({ header: textHeader, type: textType, postData: textReq?.postData }));
await page.eval(`[...document.querySelectorAll('.mode-switch button')][1].click()`);
await sleep(250);
let releaseOk = true;
try { await fulfill(held[0].requestId, oldText); } catch { releaseOk = false; }
await sleep(800);
const staleMode = await page.eval(`(() => ({ cards: document.querySelectorAll('.result-card').length, heading: !!document.querySelector('.results-head'), mode: [...document.querySelectorAll('.mode-switch button')].findIndex((b) => b.getAttribute('aria-pressed') === 'true'), queryHidden: !document.querySelector('#ai-query'), pending: !!document.querySelector('.search-status'), submitDisabled: document.querySelector('.search-submit')?.disabled }))()`);
record("STALE mode: đổi sang Ảnh khi request chữ đang chờ → không repaint kết quả cũ",
  heldText && staleMode.cards === 0 && !staleMode.heading && staleMode.mode === 1 && staleMode.queryHidden && !staleMode.pending && staleMode.submitDisabled === false,
  JSON.stringify({ heldText, releaseOk, staleMode, searchSeen }));

// 2) Stale after input edit: hold text search, edit query, release old JSON.
await page.goto(`${base}/tim-kiem-ai`);
await ready();
held.length = 0;
await setQuery("áo cũ lần hai");
await page.eval(`document.querySelector('form.search-form').requestSubmit()`);
const heldInput = await waitFor(() => held.length === 1);
await setQuery("áo mới đang sửa");
await sleep(150);
try { await fulfill(held[0].requestId, oldText); } catch { /* aborted */ }
await sleep(700);
const staleInput = await page.eval(`(() => ({ cards: document.querySelectorAll('.result-card').length, query: document.querySelector('#ai-query')?.value, pending: !!document.querySelector('.search-status') }))()`);
record("STALE input: sửa mô tả khi request đang chờ → kết quả cũ không commit",
  heldInput && staleInput.cards === 0 && staleInput.query === "áo mới đang sửa" && !staleInput.pending,
  JSON.stringify({ heldInput, staleInput }));

// 3) Double submit during image decode: only one intercepted image request.
await page.goto(`${base}/tim-kiem-ai`);
await ready();
await page.eval(`[...document.querySelectorAll('.mode-switch button')][1].click()`);
await sleep(200);
await page.setFile("#ai-file", png);
held.length = 0;
searchSeen = 0;
await submitTwice();
const imageHeld = await waitFor(() => held.length >= 1);
await sleep(900);
const imageCount = held.filter((h) => h.url.includes("/search/image")).length;
const imageReq = held.find((h) => h.url.includes("/search/image"));
const imageType = Object.entries(imageReq?.headers ?? {}).find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "";
record("beWrite signal: image vẫn gửi multipart file/limit + CSRF",
  imageType.includes("multipart/form-data") && (imageReq?.postData ?? "").includes('name="file"')
    && (imageReq?.postData ?? "").includes('name="limit"'),
  JSON.stringify({ type: imageType, postData: (imageReq?.postData ?? "").slice(0, 200) }));
record("DOUBLE image: hai submit đồng bộ trong lúc decode chỉ tạo 1 request ảnh",
  imageHeld && imageCount === 1 && searchSeen === 1,
  JSON.stringify({ imageCount, searchSeen }));
if (held[0]) { try { await fulfill(held[0].requestId, imageOk); } catch { /* aborted */ } }
await sleep(500);

// 4) Double submit during composed pre-decode: only one intercepted composed request.
await page.goto(`${base}/tim-kiem-ai`);
await ready();
await page.eval(`[...document.querySelectorAll('.mode-switch button')][2].click()`);
await sleep(200);
await setQuery("áo khoác");
await page.setFile("#ai-file", png);
held.length = 0;
searchSeen = 0;
await submitTwice();
const composedHeld = await waitFor(() => held.length >= 1);
await sleep(900);
const composedCount = held.filter((h) => h.url.includes("/search/composed")).length;
record("DOUBLE composed: hai submit đồng bộ trước decode chỉ tạo 1 request composed",
  composedHeld && composedCount === 1 && searchSeen === 1,
  JSON.stringify({ composedCount, searchSeen }));
if (held[0]) { try { await fulfill(held[0].requestId, composedOk); } catch { /* aborted */ } }
await sleep(500);

// 5) Abort while CSRF is pending: must not reach search POST or stale UI.
await page.goto(`${base}/tim-kiem-ai`);
await ready();
holdCsrf = true;
csrfHeld.length = 0;
held.length = 0;
searchSeen = 0;
await setQuery("csrf pending");
await page.eval(`document.querySelector('form.search-form').requestSubmit()`);
const csrfWaiting = await waitFor(() => csrfHeld.length === 1);
await page.eval(`[...document.querySelectorAll('.mode-switch button')][1].click()`);
await sleep(250);
try { await fulfill(csrfHeld[0], CSRF); } catch { /* aborted */ }
await sleep(700);
const csrfAbort = await page.eval(`(() => ({ cards: document.querySelectorAll('.result-card').length, pending: !!document.querySelector('.search-status'), submitDisabled: document.querySelector('.search-submit')?.disabled }))()`);
record("ABORT CSRF: hủy khi CSRF đang chờ → không gửi search POST, không commit UI cũ",
  csrfWaiting && searchSeen === 0 && csrfAbort.cards === 0 && !csrfAbort.pending && csrfAbort.submitDisabled === false,
  JSON.stringify({ csrfWaiting, searchSeen, csrfAbort }));
holdCsrf = false;

// 6) Owner-aware cleanup: old op aborted, new op must stay locked; a third submit is blocked.
await page.goto(`${base}/tim-kiem-ai`);
await ready();
held.length = 0;
searchSeen = 0;
await setQuery("op A");
await page.eval(`document.querySelector('form.search-form').requestSubmit()`);
const opA = await waitFor(() => held.length === 1);
await page.eval(`[...document.querySelectorAll('.mode-switch button')][1].click()`);
await sleep(200);
await page.eval(`[...document.querySelectorAll('.mode-switch button')][0].click()`);
await sleep(200);
await setQuery("op B");
await page.eval(`document.querySelector('form.search-form').requestSubmit()`);
const opB = await waitFor(() => held.length === 2);
await page.eval(`document.querySelector('form.search-form').requestSubmit()`);
await sleep(700);
const lock = await page.eval(`(() => ({ pending: !!document.querySelector('.search-status'), submitDisabled: document.querySelector('.search-submit')?.disabled }))()`);
const searchAfterThird = searchSeen;
if (held[0]) { try { await fulfill(held[0].requestId, oldText); } catch { /* aborted */ } }
if (held[1]) { try { await fulfill(held[1].requestId, imageOk); } catch { /* aborted */ } }
await sleep(600);
const opBResult = await page.eval(`(() => ({ cards: document.querySelectorAll('.result-card').length, files: [...document.querySelectorAll('.result-copy h3')].map((h) => h.textContent) }))()`);
record("OWNER lock: cleanup op cũ không mở khóa op mới; submit thứ ba bị chặn",
  opA && opB && searchAfterThird === 2 && lock.pending && lock.submitDisabled === true
    && opBResult.cards === 1 && opBResult.files.join("|") === "img.jpg",
  JSON.stringify({ opA, opB, searchAfterThird, lock, opBResult }));

// 7) Abort during image decode: submit + switch mode in the same JS task.
await page.goto(`${base}/tim-kiem-ai`);
await ready();
await page.eval(`[...document.querySelectorAll('.mode-switch button')][1].click()`);
await sleep(200);
await page.setFile("#ai-file", png);
held.length = 0;
searchSeen = 0;
await page.eval(`(() => { document.querySelector('form.search-form').requestSubmit(); [...document.querySelectorAll('.mode-switch button')][0].click(); return true; })()`);
await sleep(1000);
const decodeAbort = await page.eval(`(() => ({ cards: document.querySelectorAll('.result-card').length, pending: !!document.querySelector('.search-status'), submitDisabled: document.querySelector('.search-submit')?.disabled, mode: [...document.querySelectorAll('.mode-switch button')].findIndex((b) => b.getAttribute('aria-pressed') === 'true') }))()`);
record("ABORT decode: submit ảnh rồi đổi mode trong cùng task → không POST search, không commit UI",
  searchSeen === 0 && decodeAbort.cards === 0 && !decodeAbort.pending && decodeAbort.submitDisabled === false && decodeAbort.mode === 0,
  JSON.stringify({ searchSeen, decodeAbort }));

await writeFile(join(outDir, "ai-async-report.json"), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
proc.kill();
process.exit(failed.length === 0 ? 0 : 1);
