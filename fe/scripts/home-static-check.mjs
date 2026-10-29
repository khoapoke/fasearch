// Bằng chứng trình duyệt cho Home A r2 (static slice) — chạy trên candidate 3110.
//
// Kiểm A1–A3 và A4 (không tự gửi request khi chuyển bước demo):
//   - bản tĩnh hoàn chỉnh là mặc định; ba bước chuyển tay, tức thời
//   - hình học chữ/CTA không xê dịch (không có motion)
//   - light/dark/system + không flash sai màu; 320/390/768/1440 không tràn ngang
//   - bàn phím: Tab + Enter đổi bước, có viền tiêu điểm
//   - ảnh lỗi và lỗi API sản phẩm (partial/error) là trạng thái THẬT, có retry
//
// Dùng: node scripts/home-static-check.mjs <baseUrl> <outDir>
// Không ghi dữ liệu: chỉ đọc, không gọi API ghi, không tạo đơn/tồn kho.

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = process.env.CHROME_BIN
  || "/home/dolakhoa/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome";

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
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
        return;
      }
      if (msg.method === "Network.requestWillBeSent") this.requests.push(msg.params.request.url);
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
  async setViewport(width, height = 900) {
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  }
  async setColorScheme(scheme) {
    await this.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  }
  async blockUrls(patterns) {
    await this.send("Network.setBlockedURLs", { urls: patterns });
  }
  async shot(file) {
    const r = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(file, Buffer.from(r.data, "base64"));
  }
  apiRequests() {
    return this.requests.filter((u) => u.includes("/api/"));
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
    } catch { /* chưa lên */ }
    await sleep(150);
  }
  proc.kill();
  throw new Error(`Chrome ${port} không khởi động`);
}

async function newPage(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const page = new Page(ws);
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Network.enable");
  return page;
}

async function withBrowser(port, profile, fn) {
  const proc = await launch(port, profile);
  try {
    return await fn(await newPage(port));
  } finally {
    proc.kill();
  }
}

const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) {
  console.error("dùng: node scripts/home-static-check.mjs <baseUrl> <outDir>");
  process.exit(1);
}
const shots = join(outDir, "shots");
await mkdir(shots, { recursive: true });

const DEMO_PROBE = `(() => {
  const step = document.querySelector('[data-step]')?.getAttribute('data-step');
  const pressed = [...document.querySelectorAll('.hmDemoStep')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent.trim());
  const outcome = document.querySelector('.hmDemoOutcome');
  const box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + window.scrollX), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
  return {
    step, pressed,
    query: document.querySelector('.hmQueryCopy')?.textContent?.trim() ?? null,
    tags: [...document.querySelectorAll('.hmTags dd')].map(e => e.textContent.trim()),
    idle: !!document.querySelector('.hmOutcomeIdle'),
    suggestion: !!document.querySelector('.hmSuggestion'),
    result: box('.hmResultCard'),
    price: document.querySelector('.hmResultPrice')?.textContent?.trim() ?? null,
    tryBox: box('.hmTry'),
    outcomeBox: box('.hmDemoOutcome'),
    purchaseLinks: [...document.querySelectorAll('.hmDemo a[href]')]
      .map(a => a.getAttribute('href')).filter(h => /gio-hang|thanh-toan|don-hang/.test(h)),
    addToCart: [...document.querySelectorAll('.hmDemo button')].filter(b => /thêm vào giỏ|mua/i.test(b.textContent)).length,
    theme: document.documentElement.getAttribute('data-theme'),
    themeChoice: document.documentElement.getAttribute('data-theme-choice'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`;

await withBrowser(9411, "/tmp/home-r2-a", async (p) => {
  // Đặt viewport TRƯỚC mọi phép đo: cửa sổ headless mặc định 800px sẽ cho layout
  // một cột, khác hẳn bề rộng thật cần kiểm.
  await p.setViewport(1280, 900);
  await p.send("Network.setCacheDisabled", { cacheDisabled: true });

  // ---------- A1: default = complete static result ----------
  await p.goto(`${base}/`);
  const initial = await p.eval(DEMO_PROBE);
  record("A1 mặc định là kết quả tĩnh hoàn chỉnh (bước 03 đang chọn)",
    initial.step === "explore" && initial.pressed.join("").includes("Xem món đồ"),
    JSON.stringify({ step: initial.step, pressed: initial.pressed }));
  record("A1 hiện đủ mô tả + thẻ gợi ý + giá minh họa",
    !!initial.query && !!initial.result && initial.price === "549.000 ₫" && initial.tags.length === 2,
    JSON.stringify({ query: initial.query?.slice(0, 24), price: initial.price, tags: initial.tags }));
  record("A1 demo KHÔNG có liên kết mua/giỏ/thanh toán và không có nút thêm giỏ",
    initial.purchaseLinks.length === 0 && initial.addToCart === 0,
    JSON.stringify({ purchaseLinks: initial.purchaseLinks, addToCart: initial.addToCart }));

  const hasInertControls = await p.eval(`(() => {
    const btns = [...document.querySelectorAll('.hmDemo button')].map(b => b.textContent.trim());
    return { labels: btns, inert: btns.filter(t => /tạm dừng|phát lại|pause|replay/i.test(t)) };
  })()`);
  record("A1 không có nút Pause/Replay không chức năng",
    hasInertControls.inert.length === 0, JSON.stringify(hasInertControls));

  // ---------- A1/A3: ba bước chuyển tay, tức thời ----------
  const stepButtons = await p.eval(`[...document.querySelectorAll('.hmDemoStep')].map(b => b.textContent.trim())`);
  record("A1 có đúng ba bước Mô tả / Gợi ý / Xem món đồ",
    stepButtons.length === 3 && stepButtons[0].includes("Mô tả") && stepButtons[1].includes("Gợi ý") && stepButtons[2].includes("Xem món đồ"),
    JSON.stringify(stepButtons));

  const clickStep = async (label) => p.eval(`(() => {
    const btn = [...document.querySelectorAll('.hmDemoStep')].find(b => b.textContent.includes(${JSON.stringify(label)}));
    if (!btn) return false; btn.click(); return true;
  })()`);

  await clickStep("Mô tả");
  await sleep(120);
  const s1 = await p.eval(DEMO_PROBE);
  record("A1 bước Mô tả: hiện mô tả, ẩn gợi ý (đổi tức thì)",
    s1.step === "describe" && s1.idle && !s1.suggestion && !s1.result && s1.tags.length === 0,
    JSON.stringify({ step: s1.step, idle: s1.idle, suggestion: s1.suggestion, tags: s1.tags }));

  await clickStep("Gợi ý");
  await sleep(120);
  const s2 = await p.eval(DEMO_PROBE);
  record("A1 bước Gợi ý: hiện nhãn danh mục/màu + minh họa tìm gợi ý",
    s2.step === "suggest" && s2.suggestion && s2.tags.length === 2 && !s2.result,
    JSON.stringify({ step: s2.step, suggestion: s2.suggestion, tags: s2.tags }));

  await clickStep("Xem món đồ");
  await sleep(120);
  const s3 = await p.eval(DEMO_PROBE);
  record("A1 quay lại bước 03: kết quả + giá hiện lại đúng",
    s3.step === "explore" && !!s3.result && s3.price === "549.000 ₫",
    JSON.stringify({ step: s3.step, price: s3.price }));

  // ---------- A3: hình học chữ/CTA ổn định (không motion) ----------
  const sameBox = (a, b) => a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
  const t0 = await p.eval(DEMO_PROBE);
  await sleep(400);
  const t1 = await p.eval(DEMO_PROBE);
  await sleep(600);
  const t2 = await p.eval(DEMO_PROBE);
  record("A3 chữ/CTA/thẻ kết quả KHÔNG xê dịch theo thời gian (không có animation)",
    sameBox(t0.result, t1.result) && sameBox(t1.result, t2.result) && sameBox(t0.tryBox, t2.tryBox),
    JSON.stringify({ t0: t0.result, t2: t2.result }));

  const backToExplore = await p.eval(DEMO_PROBE);
  record("A3 chuyển bước đi rồi về không làm lệch hình học (không tích luỹ layout shift)",
    sameBox(initial.result, backToExplore.result) && sameBox(initial.tryBox, backToExplore.tryBox),
    JSON.stringify({ before: initial.result, after: backToExplore.result }));

  // ---------- A4: chuyển bước KHÔNG tự gửi request ----------
  const beforeSteps = p.apiRequests().length;
  for (const label of ["Mô tả", "Gợi ý", "Xem món đồ", "Mô tả", "Xem món đồ"]) {
    await clickStep(label);
    await sleep(150);
  }
  await sleep(700);
  const afterSteps = p.apiRequests().length;
  record("A4 chuyển bước demo không gửi request API nào",
    afterSteps - beforeSteps === 0, `${beforeSteps} → ${afterSteps} request /api/`);

  // ---------- A3: bàn phím (dùng phím Tab THẬT của trình duyệt) ----------
  const tabKey = async () => {
    // keyDown (không phải rawKeyDown) mới chạy được việc chuyển tiêu điểm của trình duyệt.
    await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await sleep(100);
  };
  // Bắt đầu từ CTA thứ hai của hero: sau nó chỉ còn 3 lựa chọn cách tìm rồi tới bước demo.
  await p.eval(`document.querySelector('.hmCtaOutline').focus()`);
  let reached = null;
  for (let i = 0; i < 12; i += 1) {
    await tabKey();
    reached = await p.eval(`(() => { const a = document.activeElement;
      return a ? { tag: a.tagName, cls: (a.className || '').toString().slice(0, 30), text: (a.textContent || '').trim().slice(0, 24),
        step: a.classList.contains('hmDemoStep') } : null; })()`);
    if (reached?.step) break;
  }
  record("A3 bàn phím: Tab tới được nút bước của demo", !!reached?.step, JSON.stringify(reached));

  const focusRing = await p.eval(`(() => {
    const cs = getComputedStyle(document.activeElement);
    return { focusVisible: document.activeElement.matches(':focus-visible'),
      width: cs.outlineWidth, style: cs.outlineStyle, offset: cs.outlineOffset, color: cs.outlineColor };
  })()`);
  record("A3 bàn phím: viền tiêu điểm 2px lệch 3px nhìn thấy được",
    focusRing.focusVisible && focusRing.width === "2px" && focusRing.style === "solid" && focusRing.offset === "3px",
    JSON.stringify(focusRing));

  // Enter trên nút đang tiêu điểm phải đổi bước (hành vi bàn phím thật).
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r" });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await sleep(250);
  const kb = await p.eval(`(() => ({ step: document.querySelector('[data-step]').getAttribute('data-step'),
    pressed: [...document.querySelectorAll('.hmDemoStep')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent.trim()) }))()`);
  record("A3 bàn phím: Enter đổi bước demo", kb.step !== "explore", JSON.stringify(kb));

  // ---------- A3: hai theme + bốn bề rộng ----------
  for (const scheme of ["light", "dark"]) {
    await p.setColorScheme(scheme);
    await p.goto(`${base}/`);
    for (const w of [320, 390, 768, 1440]) {
      await p.setViewport(w, w < 768 ? 780 : 900);
      await p.goto(`${base}/`);
      const probe = await p.eval(DEMO_PROBE);
      const themeOk = probe.theme === scheme;
      record(`A3 ${scheme} @${w}px: không tràn ngang + theme đúng + demo có kết quả`,
        (probe.overflow ?? 0) <= 1 && themeOk && !!probe.result,
        `overflow ${probe.overflow}px theme=${probe.theme}`);
    }
    await p.setViewport(1440, 900);
    await p.goto(`${base}/`);
    await sleep(400);
    await p.shot(join(shots, `home-1440-${scheme}.png`));
  }
  await p.setViewport(390, 780);
  await p.goto(`${base}/`);
  await sleep(400);
  await p.shot(join(shots, "home-390-light.png"));

  // 200% zoom trên cửa sổ 1280: mô hình reflow đúng là viewport CSS 640px.
  // (Đây là proxy reflow, KHÔNG phải ảnh chụp ở 200% — ghi rõ trong handoff.)
  await p.setColorScheme("light");
  await p.setViewport(640, 900);
  await p.goto(`${base}/`);
  const zoom = await p.eval(DEMO_PROBE);
  record("A3 200% zoom (proxy reflow 640px): không tràn ngang, demo vẫn có kết quả",
    (zoom.overflow ?? 0) <= 1 && !!zoom.result,
    `overflow ${zoom.overflow}px result=${!!zoom.result}`);
  await p.shot(join(shots, "home-zoom200-proxy-640.png"));

  // ---------- A3: theme theo lựa chọn thiết bị, nhớ sau reload ----------
  await p.setColorScheme("light");
  await p.setViewport(1280, 900);
  await p.goto(`${base}/`);
  const themeControl = await p.eval(`(() => {
    const sel = document.querySelector('.stThemeSelect');
    if (!sel) return { ok: false };
    const set = (v) => { const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      s.call(sel, v); sel.dispatchEvent(new Event('change', { bubbles: true })); };
    set('dark');
    const after = document.documentElement.getAttribute('data-theme');
    return { ok: true, after, choice: document.documentElement.getAttribute('data-theme-choice') };
  })()`);
  record("A3 chọn Tối trên Home: theme áp ngay",
    themeControl.ok && themeControl.after === "dark", JSON.stringify(themeControl));
  await p.goto(`${base}/`);
  const persisted = await p.eval(`({ theme: document.documentElement.getAttribute('data-theme'), choice: document.documentElement.getAttribute('data-theme-choice') })`);
  record("A3 lựa chọn thiết bị được nhớ sau khi tải lại",
    persisted.theme === "dark" && persisted.choice === "dark", JSON.stringify(persisted));
  await p.eval(`(() => { const sel = document.querySelector('.stThemeSelect');
    const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    s.call(sel, 'system'); sel.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await p.goto(`${base}/`);
  const systemAgain = await p.eval(`document.documentElement.getAttribute('data-theme-choice')`);
  record("A3 quay lại 'Theo thiết bị' được", systemAgain === "system", `choice=${systemAgain}`);

  // ---------- A2: ảnh lỗi phải báo rõ ----------
  await p.setViewport(1280, 900);
  await p.blockUrls(["*://images.unsplash.com/*"]);
  await p.goto(`${base}/`);
  await sleep(2500);
  const imgFail = await p.eval(`(() => {
    const fail = document.querySelector('.hmImgFail');
    return { count: document.querySelectorAll('.hmImgFail').length,
      text: fail?.textContent?.trim() ?? null,
      label: fail?.getAttribute('aria-label') ?? null };
  })()`);
  record("A2 ảnh lỗi hiện thông báo rõ (kèm nhãn cho trình đọc màn hình)",
    imgFail.count > 0 && /Không tải được ảnh/.test(imgFail.text ?? "") && /Không tải được ảnh/.test(imgFail.label ?? ""),
    JSON.stringify(imgFail));
  await p.shot(join(shots, "home-image-failure.png"));
  await p.blockUrls([]);

  // ---------- A2: lỗi API sản phẩm -> partial/error thật, có retry ----------
  await p.blockUrls(["*/api/be/v1/catalog/san-pham*"]);
  await p.goto(`${base}/`);
  await sleep(2000);
  const partial = await p.eval(`(() => ({
    alert: document.querySelector('.hmStateError strong')?.textContent?.trim() ?? null,
    retry: !!document.querySelector('.hmRetry'),
    cats: document.querySelectorAll('.hmCat').length,
    grid: document.querySelectorAll('.pgGrid .pCard').length,
    bodyText: document.body.innerText.includes('Không tải được sản phẩm'),
  }))()`);
  record("A2 API sản phẩm lỗi: hiện trạng thái lỗi/partial + nút thử lại, KHÔNG bịa dữ liệu bán",
    !!partial.alert && partial.retry && partial.grid === 0 && partial.bodyText,
    JSON.stringify(partial));
  await p.shot(join(shots, "home-product-error.png"));

  await p.blockUrls([]);
  await p.eval(`(() => { const b = document.querySelector('.hmRetry'); if (b) b.click(); return !!b; })()`);
  await sleep(2500);
  const recovered = await p.eval(`(() => ({
    cards: document.querySelectorAll('.pgGrid .pCard').length,
    alert: !!document.querySelector('.hmStateError'),
  }))()`);
  record("A2 bấm thử lại sau lỗi: tải lại được sản phẩm thật",
    recovered.cards > 0 && !recovered.alert, JSON.stringify(recovered));

  // ---------- CONTROL-PALETTE-02: bảng màu Home khớp snapshot 6fdbcee ----------
  // Lựa chọn theme lúc này là "Theo thiết bị" → emulated scheme phải ra đúng
  // data-theme; token đọc trên chính phần tử mang `.hmPalette` (shell + section).
  const PALETTE_PROBE = `(() => {
    const root = document.querySelector('.hmPalette');
    const home = document.querySelector('.hmHome');
    const footer = document.querySelector('.sfFooter');
    if (!root || !home || !footer) return { missing: true };
    const cs = getComputedStyle(root);
    const keys = ['--st-canvas','--st-surface','--st-raised','--st-select','--st-ink',
      '--st-ink-soft','--st-line','--st-brand','--st-brand-hover','--st-brand-text',
      '--st-focus','--st-control-border','--st-ok-text','--st-ok-bg','--st-err-text','--st-err-bg'];
    const tokens = {};
    for (const k of keys) tokens[k] = cs.getPropertyValue(k).trim();
    return { tokens,
      homeBg: getComputedStyle(home).backgroundColor,
      footerBg: getComputedStyle(footer).backgroundColor,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      theme: document.documentElement.getAttribute('data-theme') };
  })()`;
  const PALETTE_EXPECT = {
    light: {
      tokens: {
        "--st-canvas": "#fbfaf7", "--st-surface": "#ffffff", "--st-raised": "#ffffff",
        "--st-select": "#f1f0ea", "--st-ink": "#1b1c1a", "--st-ink-soft": "#5f655c",
        "--st-line": "#dedfd7", "--st-brand": "#3730d8", "--st-brand-hover": "#2d27bc",
        "--st-brand-text": "#3730d8", "--st-focus": "#3730d8", "--st-control-border": "#6f766c",
        "--st-ok-text": "#24663c", "--st-ok-bg": "#e8f1ea",
        "--st-err-text": "#a6293a", "--st-err-bg": "#f9eaec",
      },
      homeBg: "rgb(251, 250, 247)",
      footerBg: "rgb(255, 255, 255)",
      bodyBg: "rgb(251, 250, 247)",
    },
    dark: {
      tokens: {
        "--st-canvas": "#08090b", "--st-surface": "#101113", "--st-raised": "#1e1f23",
        "--st-select": "#17181b", "--st-ink": "#edeef0", "--st-ink-soft": "#9ba1a6",
        "--st-line": "#26282c", "--st-brand": "#3730d8", "--st-brand-hover": "#2d27bc",
        "--st-brand-text": "#b4b0ff", "--st-focus": "#c6c2ff", "--st-control-border": "#7b8290",
        "--st-ok-text": "#93c6a1", "--st-ok-bg": "#16211a",
        "--st-err-text": "#efb0b7", "--st-err-bg": "#2c1b1e",
      },
      homeBg: "rgb(8, 9, 11)",
      footerBg: "rgb(16, 17, 19)",
      bodyBg: "rgb(8, 9, 11)",
    },
  };
  const hexLum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  // Chrome serialize màu trong custom property (vd #ffffff → #fff): so sánh đã chuẩn hoá.
  const normHex = (h) => {
    const v = String(h ?? "").trim().toLowerCase();
    return /^#[0-9a-f]{3}$/.test(v) ? "#" + [...v.slice(1)].map((c) => c + c).join("") : v;
  };
  const contrast = (a, b) => {
    const [hi, lo] = [hexLum(a), hexLum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  for (const scheme of ["light", "dark"]) {
    await p.setColorScheme(scheme);
    for (const [w, h] of [[1440, 900], [390, 780]]) {
      await p.setViewport(w, h);
      await p.goto(`${base}/`);
      await sleep(250);
      const page = await p.eval(PALETTE_PROBE);
      const exp = PALETTE_EXPECT[scheme];
      const wrong = Object.entries(exp.tokens)
        .filter(([k, v]) => normHex(page.tokens?.[k]) !== normHex(v))
        .map(([k, v]) => `${k}=${page.tokens?.[k]}≠${v}`);
      record(`PALETTE ${scheme} @${w}px: token Home khớp snapshot 6fdbcee`,
        !!page.tokens && wrong.length === 0, wrong.join(", ") || "16/16 token khớp");
      record(`PALETTE ${scheme} @${w}px: canvas Home/footer/body đúng màu đã duyệt`,
        page.homeBg === exp.homeBg && page.footerBg === exp.footerBg && page.bodyBg === exp.bodyBg
          && page.theme === scheme,
        JSON.stringify({ home: page.homeBg, footer: page.footerBg, body: page.bodyBg, theme: page.theme }));
      const ratios = {
        text: contrast(normHex(page.tokens["--st-ink"]), normHex(page.tokens["--st-canvas"])),
        muted: contrast(normHex(page.tokens["--st-ink-soft"]), normHex(page.tokens["--st-canvas"])),
        error: contrast(normHex(page.tokens["--st-err-text"]), normHex(page.tokens["--st-err-bg"])),
      };
      record(`PALETTE ${scheme} @${w}px: tương phản text/muted/error ≥ 4.5:1`,
        Object.values(ratios).every((r) => r >= 4.5),
        Object.entries(ratios).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(" · "));
      await p.shot(join(shots, `home-palette-${w}-${scheme}.png`));
    }
  }

  // ---------- CONTROL-CANVAS-03: B2 + signature motif vs frozen 6fdbcee ----------
  const B2_PATH = "M108,332 C240,350 390,260 500,220 C610,180 728,230 714,292 C700,354 570,347 522,318 C474,289 475,223 486,178";
  const CANVAS_PROBE = `(() => {
    const q = (s) => document.querySelector(s);
    const home = q('.hmHome');
    if (!home) return { missing: true };
    const hr = home.getBoundingClientRect();
    const at = (sel) => { const el = q(sel); if (!el) return null; const b = el.getBoundingClientRect();
      return { top: b.top - hr.top, bottom: b.bottom - hr.top, left: b.left - hr.left, right: b.right - hr.left, width: b.width }; };
    const copy = at('.hmHeroCopy'), figure = at('.hmHeroFigure'), explain = at('.hmModes');
    const layer = q('.hmCanvas'), tl = q('.hmThreadline'), path = q('.hmThreadline path');
    const motif = q('.hmMotif'), msvg = q('.hmMotif svg');
    const cs = (el) => el ? getComputedStyle(el) : null;
    const interactive = [...document.querySelectorAll('.hmHome a,.hmHome button,.hmHome input,.hmHome select,.hmHome textarea,.hmHome summary')]
      .map((el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    const hits = (svgPath) => {
      if (!svgPath) return -1;
      const L = svgPath.getTotalLength(), m = svgPath.getScreenCTM();
      let n = 0;
      for (let i = 0; i <= 120; i += 1) {
        const p = svgPath.getPointAtLength((L * i) / 120);
        const v = new DOMPoint(p.x, p.y).matrixTransform(m);
        if (interactive.some((r) => v.x >= r.x && v.x <= r.x + r.w && v.y >= r.y && v.y <= r.y + r.h)) n += 1;
      }
      return n;
    };
    const top = Math.max(copy.bottom, figure.bottom) + 10, bottom = explain.top - 10;
    const left = figure.left + 8, right = figure.right - 8, center = figure.left + figure.width * 0.62;
    const scale = Math.min(360 / 800, (bottom - top) / 208, (right - left) / 620);
    const paintLeft = Math.min(Math.max(center - (620 * scale) / 2, left), right - 620 * scale);
    const num = (v) => parseFloat(v) || 0;
    return {
      fit: layer?.dataset.fit, reason: layer?.dataset.reason,
      vars: { left: num(layer?.style.getPropertyValue('--hm-thread-left')), top: num(layer?.style.getPropertyValue('--hm-thread-top')), width: num(layer?.style.getPropertyValue('--hm-thread-width')), height: num(layer?.style.getPropertyValue('--hm-thread-height')) },
      expect: { left: +(paintLeft - 108 * scale).toFixed(2), top: +(top + (bottom - top - 208 * scale) / 2 - 155 * scale).toFixed(2), width: +(800 * scale).toFixed(2), height: +(500 * scale).toFixed(2) },
      display: cs(tl)?.display, opacity: cs(tl)?.opacity, color: cs(tl)?.color, pointerEvents: cs(tl)?.pointerEvents,
      transition: cs(tl)?.transitionDuration, animation: cs(tl)?.animationName,
      pathD: path?.getAttribute('d'), viewBox: q('.hmThreadline')?.getAttribute('viewBox'), strokeWidth: path?.getAttribute('stroke-width'),
      ink: (() => { const ctm = path?.getScreenCTM(); if (!ctm) return null; return { top: +(ctm.f + 155 * ctm.d - hr.top).toFixed(2), bottom: +(ctm.f + 363 * ctm.d - hr.top).toFixed(2), left: +(ctm.e + 108 * ctm.a - hr.left).toFixed(2), right: +(ctm.e + 728 * ctm.a - hr.left).toFixed(2) }; })(),
      slot: { top: +top.toFixed(2), bottom: +bottom.toFixed(2), left: +left.toFixed(2), right: +right.toFixed(2) },
      motifOffset: (() => { const mr = motif?.getBoundingClientRect(); if (!mr) return null; return { right: +((hr.left + copy.right) - mr.right).toFixed(2), bottom: +((hr.top + copy.bottom) - mr.bottom).toFixed(2) }; })(),
      motif: { display: cs(motif)?.display, opacity: cs(motif)?.opacity, color: cs(motif)?.color, pointerEvents: cs(motif)?.pointerEvents,
        ariaHidden: motif?.getAttribute('aria-hidden'), size: motif ? +motif.getBoundingClientRect().width.toFixed(0) : null,
        paths: msvg ? [...msvg.querySelectorAll('path')].map((p) => p.getAttribute('d')) : null,
        viewBox: msvg?.getAttribute('viewBox'), strokeWidth: msvg?.getAttribute('stroke-width') },
      occluded: { canvas: hits(path), motif: hits(msvg?.querySelector('path')) },
      spacing: { heroPadTop: cs(q('.hmHero'))?.paddingTop, heroPadBottom: cs(q('.hmHero'))?.paddingBottom, explainMarginTop: cs(q('.hmModes'))?.marginTop },
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      crop: (() => { const img = q('.hmResultMedia img'); const ci = cs(img); return ci ? { objectPosition: ci.objectPosition, transform: ci.transform } : null; })(),
    };
  })()`;
  const CANVAS_EXPECT = {
    "1440x1000": { width: 307.69, height: 192.31, motif: 148, padTop: "30px", padBottom: "60px", marginTop: "40px" },
    "390x844": { width: 247.6, height: 154.75, motif: 84, padTop: "25.32px", padBottom: "50.64px", marginTop: "33.76px" },
  };
  const MOTIF_PATHS = ["M148 32V148H64", "M64 148H32"];

  for (const scheme of ["light", "dark"]) {
    await p.setColorScheme(scheme);
    for (const [w, h] of [[1440, 1000], [390, 844]]) {
      await p.setViewport(w, h);
      await p.goto(`${base}/`);
      await sleep(350);
      const c = await p.eval(CANVAS_PROBE);
      const exp = CANVAS_EXPECT[`${w}x${h}`];
      const close = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
      record(`CANVAS ${scheme} @${w}x${h}: B2 hiện đúng (visible/after-hero, không motion)`,
        c.fit === "visible" && c.reason === "after-hero" && c.display === "block" && c.opacity === "0.72"
          && c.pointerEvents === "none" && c.transition === "0s" && c.animation === "none",
        JSON.stringify({ fit: c.fit, reason: c.reason, display: c.display, opacity: c.opacity, pointer: c.pointerEvents, transition: c.transition, animation: c.animation }));
      record(`CANVAS ${scheme} @${w}x${h}: fit B2 khớp tham chiếu (rộng ${exp.width} · cao ${exp.height})`,
        close(c.vars.width, exp.width) && close(c.vars.height, exp.height)
          && close(c.vars.width, c.expect.width) && close(c.vars.height, c.expect.height)
          && close(c.vars.left, c.expect.left) && close(c.vars.top, c.expect.top),
        JSON.stringify({ got: c.vars, expect: c.expect, reference: { width: exp.width, height: exp.height } }));
      record(`CANVAS ${scheme} @${w}x${h}: asset B2 đúng path/viewBox/stroke/màu muted`,
        c.pathD === B2_PATH && c.viewBox === "0 0 800 500" && c.strokeWidth === "1.8"
          && c.color === (scheme === "light" ? "rgb(95, 101, 92)" : "rgb(155, 161, 166)"),
        JSON.stringify({ path: c.pathD === B2_PATH, viewBox: c.viewBox, stroke: c.strokeWidth, color: c.color }));
      record(`CANVAS ${scheme} @${w}x${h}: không chạm/không che control nào`,
        c.occluded.canvas === 0, `điểm path chạm control: ${c.occluded.canvas}`);
      record(`CANVAS ${scheme} @${w}x${h}: nét B2 nằm gọn trong slot giữa hero và methods`,
        !!c.ink && c.ink.top >= c.slot.top - 0.5 && c.ink.bottom <= c.slot.bottom + 0.5
          && c.ink.left >= c.slot.left - 0.5 && c.ink.right <= c.slot.right + 0.5,
        JSON.stringify({ ink: c.ink, slot: c.slot }));
      record(`MOTIF ${scheme} @${w}x${h}: signature ${exp.motif}px hiện đúng, aria-hidden, không bắt sự kiện`,
        c.motif.display === "block" && c.motif.size === exp.motif && c.motif.opacity === "0.72"
          && c.motif.color === "rgb(255, 255, 255)" && c.motif.pointerEvents === "none"
          && c.motif.ariaHidden === "true" && c.motif.viewBox === "0 0 160 160" && c.motif.strokeWidth === "2"
          && JSON.stringify(c.motif.paths) === JSON.stringify(MOTIF_PATHS),
        JSON.stringify({ size: c.motif.size, display: c.motif.display, opacity: c.motif.opacity, color: c.motif.color, paths: c.motif.paths }));
      record(`MOTIF ${scheme} @${w}x${h}: góc L neo đúng mép panel (right4/bottom4)`,
        c.motifOffset?.right === 4 && c.motifOffset?.bottom === 4, JSON.stringify(c.motifOffset));
      record(`MOTIF ${scheme} @${w}x${h}: không che control nào`,
        c.occluded.motif === 0, `điểm path chạm control: ${c.occluded.motif}`);
      record(`SPACING ${scheme} @${w}x${h}: hero padding + explain margin khớp 6fdbcee`,
        c.spacing.heroPadTop === exp.padTop && c.spacing.heroPadBottom === exp.padBottom
          && c.spacing.explainMarginTop === exp.marginTop,
        JSON.stringify(c.spacing));
      record(`REGRESSION ${scheme} @${w}x${h}: không tràn ngang + crop bomber không đổi`,
        c.overflow <= 1 && c.crop?.objectPosition === "50% 5%" && c.crop?.transform === "matrix(1.6, 0, 0, 1.6, 0, 0)",
        JSON.stringify({ overflow: c.overflow, crop: c.crop }));
      await p.shot(join(shots, `home-canvas-${w}-${scheme}.png`));
    }
  }

  // Chính sách ẩn: khi thiếu chỗ phải ẩn (không bịa ornament) và phục hồi sau resize.
  await p.setColorScheme("light");
  await p.setViewport(1440, 1000);
  await p.goto(`${base}/`);
  const hideProbe = await p.eval(`(async () => {
    const hero = document.querySelector('.hmHero'), modes = document.querySelector('.hmModes');
    const layer = document.querySelector('.hmCanvas');
    hero.style.paddingBottom = '0px'; modes.style.marginTop = '0px';
    window.dispatchEvent(new Event('resize'));
    await new Promise((r) => setTimeout(r, 250));
    const hidden = { fit: layer.dataset.fit, reason: layer.dataset.reason,
      display: getComputedStyle(document.querySelector('.hmThreadline')).display };
    hero.style.paddingBottom = ''; modes.style.marginTop = '';
    window.dispatchEvent(new Event('resize'));
    await new Promise((r) => setTimeout(r, 250));
    return { hidden, restored: { fit: layer.dataset.fit, reason: layer.dataset.reason } };
  })()`);
  record("CANVAS chính sách ẩn: thiếu chỗ → ẩn, resize lại → hiện (không bịa ornament)",
    hideProbe.hidden.fit === "none" && hideProbe.hidden.reason === "insufficient-space"
      && hideProbe.hidden.display === "none" && hideProbe.restored.fit === "visible",
    JSON.stringify(hideProbe));
});

await writeFile(join(outDir, "home-static-report.json"), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass · ảnh: ${shots}`);
process.exit(failed.length === 0 ? 0 : 1);
