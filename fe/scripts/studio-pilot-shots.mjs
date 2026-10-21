// Bằng chứng trình duyệt cho pilot search-studio (P1) — chạy trên candidate
// 3109 → BE cô lập 18096. Ba pilot: /tim-kiem-ai, /nam → /san-pham/[id], /kenh-ban/pos.
//
// Kiểm: hai theme (sáng/tối) + nhớ lựa chọn thiết bị, không tràn ngang ở
// 320/390/768/1280/1440, viền tiêu điểm thật, không còn "hản trắng" ở theme tối,
// và dữ liệu thật (AI chữ, catalog, POS rỗng + nháp đang giữ).
//
// Dùng: node scripts/studio-pilot-shots.mjs <baseUrl> <outDir>
// Không ghi đơn/tồn kho. Credential đọc từ tệp fixture KHÔNG theo dõi git, không in ra log.

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { join } from "node:path";
import { loadFixtureConfig } from "./fixture-config.mjs";

const CHROME = process.env.CHROME_BIN
  || "/home/dolakhoa/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome";
const FIXTURES = loadFixtureConfig();

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
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }
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
    await sleep(1400);
  }
  async fetchJson(path, init = {}) {
    return this.eval(`(async () => {
      const res = await fetch(${JSON.stringify(path)}, {
        method: ${JSON.stringify(init.method ?? "GET")},
        credentials: "include",
        headers: ${JSON.stringify(init.headers ?? {})},
        body: ${JSON.stringify(init.body ?? null)},
      });
      const text = await res.text();
      let body; try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
      return { status: res.status, body };
    })()`);
  }
  async csrf() {
    // CSRF của session proxy (giống hệt app: components/account/account-session.ts)
    const r = await this.fetchJson("/api/auth/csrf");
    return r.body?.result ?? {};
  }
  async login(alias) {
    const acc = FIXTURES.accounts[alias];
    if (!acc) throw new Error(`thiếu alias fixture ${alias}`);
    const c = await this.csrf();
    return this.fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", [c.headerName]: c.token },
      body: JSON.stringify({ username: acc.username, password: acc.password }),
    });
  }
  async setViewport(width, height = 900) {
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  }
  async setColorScheme(scheme) {
    await this.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  }
  async shot(file) {
    const r = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(file, Buffer.from(r.data, "base64"));
  }
}

async function launch(port, profile) {
  const proc = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return proc;
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

/** Đo tràn ngang + màu nền/màu chữ thực tế của các vùng chính. */
const SURFACE_PROBE = `(() => {
  const doc = document.documentElement;
  const overflow = doc.scrollWidth - doc.clientWidth;
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor };
  };
  return {
    overflow,
    theme: document.documentElement.getAttribute("data-theme"),
    choice: document.documentElement.getAttribute("data-theme-choice"),
    header: pick(".sfHeader, .mpBanner"),
    panel: pick(".stStudioPanel, .stPosCard, .pgSide, .stDetailPanel"),
    input: pick(".stStudioField input, .stPosInput, .stThemeSelect"),
    body: { bg: getComputedStyle(document.body).backgroundColor, color: getComputedStyle(document.body).color },
  };
})()`;

const isWhite = (rgb) => /rgba?\(\s*255,\s*255,\s*255/.test(rgb || "");
const isDark = (rgb) => {
  const m = /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/.exec(rgb || "");
  if (!m) return false;
  return (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3 < 90;
};

/**
 * Gõ thật vào ô nhập (CDP Input.insertText) để đi đúng đường sự kiện mà người
 * dùng gõ: React nhận onChange, không phải chỉ đổi DOM. Có fallback đặt giá trị
 * nếu trình duyệt không nhận phím.
 */
async function setInput(page, selector, value) {
  const focused = await page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.focus();
    return document.activeElement === el;
  })()`);
  if (!focused) return false;
  await page.send("Input.insertText", { text: value });
  await sleep(300);
  const current = await page.eval(`(document.querySelector(${JSON.stringify(selector)})?.value ?? null)`);
  if (current === value) return true;
  await page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    s.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(300);
  return (await page.eval(`(document.querySelector(${JSON.stringify(selector)})?.value ?? null)`)) === value;
}

const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) {
  console.error("dùng: node scripts/studio-pilot-shots.mjs <baseUrl> <outDir>");
  process.exit(1);
}
const shotsDir = join(outDir, "shots");
await mkdir(shotsDir, { recursive: true });

const WIDTHS = [320, 390, 768, 1280, 1440];

const part = process.env.STUDIO_PART || "all";
const runPart = (name) => part === "all" || part === name;

if (runPart("ai")) await withBrowser(9311, "/tmp/studio-pilot-cust", async (p) => {
  // ---------- 1. Pilot AI: chữ (dữ liệu thật) + hai theme ----------
  await p.goto(`${base}/dang-nhap`);
  const login = await p.login("customerA");
  record("Pilot AI: đăng nhập khách (session thật)", login.status === 200, `HTTP ${login.status}`);
  await p.goto(`${base}/tim-kiem-ai`);
  await sleep(1200);

  const aiState = await p.eval(`(() => ({
    hasPanel: !!document.querySelector(".stStudioPanel"),
    modes: [...document.querySelectorAll(".stStudioMode")].map(b => b.textContent.trim()),
    hasThemeControl: !!document.querySelector(".stThemeSelect"),
    greeting: document.querySelector(".stStudioTitle")?.textContent?.trim() ?? null,
  }))()`);
  record("Pilot AI: có studio hierarchy + 3 chế độ + control giao diện",
    aiState.hasPanel && aiState.modes.length === 3 && aiState.hasThemeControl,
    JSON.stringify(aiState));

  // Tìm bằng chữ (đọc, không ghi đơn)
  const typed = await setInput(p, 'form[aria-label="Tìm bằng AI"] input[name="q"]', "ao thun");
  record("Pilot AI: nhập từ khóa được (React đã nhận giá trị)", typed, `typed=${typed}`);
  await p.eval(`(() => { const btn = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Tìm");
    if (!btn) return false; btn.click(); return true; })()`);
  // AI đi qua BE → Python → Qdrant: chờ tới khi có kết quả hoặc hết thời gian
  for (let i = 0; i < 20; i += 1) {
    const st = await p.eval(`(() => ({
      cards: document.querySelectorAll(".stStudioCard").length,
      done: document.body.innerText.includes("kết quả AI cho"),
      empty: document.body.innerText.includes("Không có kết quả AI"),
      error: document.body.innerText.includes("Không tìm được lúc này") || document.body.innerText.includes("Hết phiên"),
      loading: document.body.innerText.includes("Đang tìm trong tập dữ liệu AI"),
    }))()`);
    if (st.cards > 0 || st.done || st.empty || st.error) break;
    await sleep(1500);
  }
  const aiResult = await p.eval(`(() => ({
    cards: document.querySelectorAll(".stStudioCard").length,
    empty: (document.body.innerText.match(/Không có kết quả AI/gi) || []).length > 0,
    error: (document.body.innerText.match(/Không tìm được lúc này|Hết phiên/gi) || []).length > 0,
    errorText: (document.querySelector(".stStudioError")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 220),
    provenance: document.querySelectorAll(".stStudioProvenance").length,
  }))()`);
  record("Pilot AI: tìm bằng chữ trả kết quả thật (không lỗi)",
    !aiResult.error && (aiResult.cards > 0 || aiResult.empty),
    JSON.stringify(aiResult));
  record("Pilot AI: kết quả có nhãn nguồn (provenance)", aiResult.cards === 0 || aiResult.provenance > 0,
    `provenance ${aiResult.provenance}`);

  // Theme: chọn "Tối" → data-theme=dark, nhớ qua reload; "Theo thiết bị" theo OS
  const themeSwitch = await p.eval(`(async () => {
    const sel = document.querySelector(".stThemeSelect");
    if (!sel) return { ok: false };
    const set = (v) => {
      const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      s.call(sel, v); sel.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set("dark");
    await new Promise(r => setTimeout(r, 200));
    const afterDark = document.documentElement.getAttribute("data-theme");
    set("system");
    await new Promise(r => setTimeout(r, 200));
    return { ok: true, afterDark, choice: document.documentElement.getAttribute("data-theme-choice") };
  })()`);
  record("Pilot AI: control giao diện đổi được sang Tối", themeSwitch.ok && themeSwitch.afterDark === "dark",
    JSON.stringify(themeSwitch));

  await p.goto(`${base}/tim-kiem-ai`);
  await sleep(800);
  const persisted = await p.eval(`document.documentElement.getAttribute("data-theme-choice")`);
  record("Pilot AI: lựa chọn thiết bị được nhớ sau khi tải lại", persisted === "system", `choice=${persisted}`);

  await p.setColorScheme("dark");
  await p.goto(`${base}/tim-kiem-ai`);
  await sleep(900);
  const osDark = await p.eval(`document.documentElement.getAttribute("data-theme")`);
  record("Pilot AI: 'Theo thiết bị' bám OS (OS tối → theme tối)", osDark === "dark", `data-theme=${osDark}`);

  // Hai theme + các bề rộng: tràn ngang và không có hản trắng ở theme tối
  for (const theme of ["light", "dark"]) {
    await p.eval(`(() => { const sel = document.querySelector(".stThemeSelect"); if (!sel) return false;
      const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      s.call(sel, "${theme}"); sel.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    for (const w of WIDTHS) {
      await p.setViewport(w, w < 768 ? 844 : 900);
      await p.goto(`${base}/tim-kiem-ai`);
      for (let i = 0; i < 12; i += 1) {
        const ready = await p.eval(`!!document.querySelector(".stStudioPanel")`);
        if (ready) break;
        await sleep(500);
      }
      const probe = await p.eval(SURFACE_PROBE);
      record(`Pilot AI ${theme} @${w}px: không tràn ngang + theme áp đúng`,
        (probe.overflow ?? 0) <= 1 && probe.theme === theme,
        `overflow ${probe.overflow}px theme=${probe.theme}`);
      if (theme === "dark") {
        record(`Pilot AI @${w}px: không có nền trắng còn sót`,
          !isWhite(probe.panel?.bg) && !isWhite(probe.input?.bg) && !isWhite(probe.body.bg),
          `panel=${probe.panel?.bg} input=${probe.input?.bg} body=${probe.body.bg}`);
      }
    }
  }
  const setTheme = async (theme) => {
    await p.goto(`${base}/tim-kiem-ai`);
    await sleep(700);
    await p.eval(`(() => { const sel = document.querySelector(".stThemeSelect"); if (!sel) return false;
      const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      s.call(sel, ${JSON.stringify(theme)}); sel.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    await sleep(400);
  };
  await p.setViewport(1280, 900);
  await setTheme("light");
  await p.shot(join(shotsDir, "ai-1280-light.png"));
  await setTheme("dark");
  await p.shot(join(shotsDir, "ai-1280-dark.png"));
  await p.setViewport(390, 844);
  await setTheme("light");
  await p.shot(join(shotsDir, "ai-390-light.png"));
  await setTheme("dark");
  await p.shot(join(shotsDir, "ai-390-dark.png"));

  // ---------- 2. Pilot catalog: /nam ----------
  await p.setViewport(1280, 900);
  for (const theme of ["light", "dark"]) {
    await p.goto(`${base}/nam`);
    await sleep(600);
    await p.eval(`(() => { const sel = document.querySelector(".stThemeSelect"); if (!sel) return false;
      const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      s.call(sel, "${theme}"); sel.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    await p.goto(`${base}/nam`);
    await sleep(1500);
    const list = await p.eval(`(() => ({
      cards: document.querySelectorAll(".pCard").length,
      hasTheme: !!document.querySelector(".stThemeSelect"),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      theme: document.documentElement.getAttribute("data-theme"),
      prices: [...document.querySelectorAll(".pCardPrice")].slice(0, 2).map(e => e.textContent.trim()),
    }))()`);
    record(`Pilot catalog /nam ${theme}: sản phẩm thật hiển thị, không tràn ngang`,
      list.cards > 0 && (list.overflow ?? 0) <= 1 && list.theme === theme,
      JSON.stringify(list));
    await p.shot(join(shotsDir, `nam-1280-${theme}.png`));
  }

  // Bộ lọc thu gọn trên điện thoại + tóm tắt bộ lọc
  await p.setViewport(390, 844);
  await p.goto(`${base}/nam`);
  await sleep(1500);
  const phone = await p.eval(`(async () => {
    const toggle = document.querySelector(".stFiltersToggle");
    const panel = document.querySelector(".stFiltersPanel");
    if (!toggle || !panel) return { ok: false };
    const before = getComputedStyle(panel).display;
    toggle.click();
    await new Promise((r) => setTimeout(r, 400));
    const after = getComputedStyle(panel).display;
    return { ok: true, toggleVisible: getComputedStyle(toggle).display !== "none", before, after,
      summary: document.querySelector(".stFiltersSummary")?.textContent?.trim() ?? null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  })()`);
  record("Pilot catalog @390px: bộ lọc thu gọn, mở được, có tóm tắt",
    phone.ok && phone.toggleVisible && phone.before === "none" && phone.after !== "none" && !!phone.summary,
    JSON.stringify(phone));
  record("Pilot catalog @390px: không tràn ngang", (phone.overflow ?? 0) <= 1, `overflow ${phone.overflow}px`);
  await p.shot(join(shotsDir, "nam-390-filters.png"));

  // Lọc thật: chọn size → URL đổi (semantics URL giữ nguyên)
  await p.setViewport(1280, 900);
  await p.goto(`${base}/nam`);
  await sleep(1500);
  const before = await p.eval("location.search");
  await p.eval(`(() => { const btn = [...document.querySelectorAll(".pgSize")].find(b => b.textContent.trim() === "M");
    if (!btn) return false; btn.click(); return true; })()`);
  await sleep(1200);
  const after = await p.eval("location.search");
  record("Pilot catalog: chọn bộ lọc cập nhật URL query (không mất đường dẫn)",
    before !== after && after.includes("kichCo="),
    `trước "${before}" → sau "${after}"`);

  // ---------- 3. Pilot chi tiết sản phẩm ----------
  const firstHref = await p.eval(`document.querySelector(".pCard a")?.getAttribute("href") ?? null`);
  if (firstHref) {
    for (const theme of ["light", "dark"]) {
      await p.goto(`${base}${firstHref}`);
      await sleep(1400);
      await p.eval(`(() => { const sel = document.querySelector(".stThemeSelect"); if (!sel) return false;
        const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        s.call(sel, "${theme}"); sel.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
      await p.goto(`${base}${firstHref}`);
      await sleep(1600);
      const detail = await p.eval(`(() => ({
        title: document.querySelector(".pdTitle")?.textContent?.trim() ?? null,
        price: document.querySelector(".pdPrice")?.textContent?.trim() ?? null,
        variants: document.querySelectorAll(".pgSize, .pdColor").length,
        theme: document.documentElement.getAttribute("data-theme"),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        panelBg: getComputedStyle(document.querySelector(".stDetailPanel")).backgroundColor,
      }))()`);
      record(`Pilot chi tiết ${theme}: sản phẩm thật + biến thể, không tràn ngang`,
        !!detail.title && !!detail.price && detail.variants > 0 && (detail.overflow ?? 0) <= 1,
        JSON.stringify(detail));
      if (theme === "dark") {
        record("Pilot chi tiết theme tối: không có nền trắng sót", !isWhite(detail.panelBg), `panel=${detail.panelBg}`);
      }
      await p.shot(join(shotsDir, `detail-1280-${theme}.png`));
    }
  } else {
    record("Pilot chi tiết: có sản phẩm để mở", false, "không tìm thấy link sản phẩm trên /nam");
  }

  // ---------- 4. Bàn phím: viền tiêu điểm thật ----------
  await p.goto(`${base}/nam`);
  await sleep(900);
  for (let i = 0; i < 3; i += 1) {
    await p.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await sleep(120);
  }
  const focus = await p.eval(`(() => { const el = document.activeElement; if (!el) return null;
    const cs = getComputedStyle(el);
    return { tag: el.tagName, text: (el.textContent || "").trim().slice(0, 30),
      focusVisible: el.matches(":focus-visible"), outline: cs.outlineWidth + " " + cs.outlineStyle + " " + cs.outlineColor,
      offset: cs.outlineOffset }; })()`);
  record("Bàn phím: Tab cho viền tiêu điểm 2px lệch 3px",
    !!focus && (focus.outline.startsWith("2px") && focus.outline.includes("solid")) && focus.offset === "3px",
    JSON.stringify(focus));
});

if (runPart("pos")) await withBrowser(9312, "/tmp/studio-pilot-staff", async (p) => {
  // ---------- 5. Pilot POS (staff) ----------
  await p.goto(`${base}/dang-nhap`);
  const login = await p.login("staff");
  record("Pilot POS: đăng nhập staff (session thật)", login.status === 200,
    `HTTP ${login.status} ${JSON.stringify(login.body).slice(0, 160)}`);
  await p.goto(`${base}/kenh-ban/pos`);
  await sleep(2000);
  const pos = await p.eval(`(() => ({
    title: document.querySelector(".stPosTitle")?.textContent?.trim() ?? null,
    hasSearch: !!document.querySelector('input[aria-label="Tìm hàng POS"]'),
    hasWarehouse: !!document.querySelector("select"),
    quoteBtn: [...document.querySelectorAll("button")].some(b => b.textContent.includes("Lấy báo giá")),
    payBtn: [...document.querySelectorAll("button")].some(b => b.textContent.includes("Thu tiền mặt")),
    drafts: (document.body.innerText.match(/Nháp đang giữ \((\d+)\)/) || [])[1] ?? null,
    theme: document.documentElement.getAttribute("data-theme"),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))()`);
  record("Pilot POS: tìm hàng, kho, báo giá và thu tiền đều hiện",
    pos.hasSearch && pos.hasWarehouse && pos.quoteBtn && pos.payBtn, JSON.stringify(pos));
  record("Pilot POS: không tràn ngang", (pos.overflow ?? 0) <= 1, `overflow ${pos.overflow}px`);

  // Tìm hàng (đọc) → kết quả thật
  await setInput(p, 'input[aria-label="Tìm hàng POS"]', "1");
  await p.eval(`(() => { const form = document.querySelector('form[role="search"]'); if (!form) return false;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); return true; })()`);
  await sleep(2000);
  const found = await p.eval(`(() => ({
    rows: document.querySelectorAll(".stPosRow").length,
    hasSku: document.body.innerText.includes("SKU"),
    error: (document.body.innerText.match(/Chọn kho trước khi tìm hàng|Nhập barcode/gi) || []).length,
  }))()`);
  record("Pilot POS: tra cứu hàng thật (không ghi đơn/tồn kho)", found.hasSku, JSON.stringify(found));

  await p.setViewport(1280, 900);
  for (const theme of ["light", "dark"]) {
    await p.goto(`${base}/kenh-ban/pos`);
    await sleep(1200);
    await p.eval(`(() => { const sel = document.querySelector(".stThemeSelect"); if (!sel) return false;
      const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      s.call(sel, "${theme}"); sel.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    await p.goto(`${base}/kenh-ban/pos`);
    await sleep(1600);
    const probe = await p.eval(SURFACE_PROBE);
    record(`Pilot POS ${theme}: theme áp đúng, không tràn ngang`,
      probe.theme === theme && (probe.overflow ?? 0) <= 1,
      `theme=${probe.theme} overflow=${probe.overflow}px`);
    if (theme === "dark") {
      record("Pilot POS theme tối: không có nền trắng sót",
        !isWhite(probe.panel?.bg) && !isWhite(probe.input?.bg) && !isWhite(probe.body.bg),
        `panel=${probe.panel?.bg} input=${probe.input?.bg} body=${probe.body.bg}`);
    }
    await p.shot(join(shotsDir, `pos-1280-${theme}.png`));
  }
  await p.setViewport(390, 844);
  await p.goto(`${base}/kenh-ban/pos`);
  await sleep(1600);
  const narrow = await p.eval(SURFACE_PROBE);
  record("Pilot POS @390px: fallback hẹp dùng được, không tràn ngang",
    (narrow.overflow ?? 0) <= 1, `overflow ${narrow.overflow}px`);
  await p.shot(join(shotsDir, "pos-390.png"));
});

await writeFile(join(outDir, "studio-pilot-report.json"), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
console.log(`Ảnh: ${shotsDir}`);
process.exit(failed.length === 0 ? 0 : 1);
