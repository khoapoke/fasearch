// Browser evidence cho Customer AI search (Tìm đồ) trên candidate 3111.
// CDP thuần Node (không thêm dependency). Chỉ đọc/không ghi dữ liệu; mock states
// qua ?preview=, live guest path không gọi AI.
// Dùng: node scripts/ai-search-check.mjs <baseUrl> <outDir>

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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
    await sleep(1800);
  }
  async setViewport(width, height = 900, dsf = 1) {
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dsf, mobile: width < 768 });
  }
  async setColorScheme(scheme) {
    await this.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  }
  async shot(file) {
    const r = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(file, Buffer.from(r.data, "base64"));
  }
  async setFile(selector, path) {
    const doc = await this.send("DOM.getDocument", { depth: 1 });
    const node = await this.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector });
    await this.send("DOM.setFileInputFiles", { files: [path], nodeId: node.nodeId });
    await sleep(350);
  }
  aiRequests() {
    return this.requests.filter((u) => u.includes("/api/be/v1/ai/"));
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
  throw new Error("Chrome CDP không khởi động");
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
  await page.send("DOM.enable");
  return page;
}

const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) {
  console.error("dùng: node scripts/ai-search-check.mjs <baseUrl> <outDir>");
  process.exit(1);
}
const shots = join(outDir, "shots");
await mkdir(shots, { recursive: true });
const fixtures = await mkdtemp(join(tmpdir(), "ai-search-fixtures-"));
// Fixtures tự tạo để harness chạy lại được mà không phụ thuộc /tmp thủ công.
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
const fixturePng = join(fixtures, "ai-fixture.png");
const fixturePng2 = join(fixtures, "ai-fixture-2.png");
const fixtureTxt = join(fixtures, "ai-fixture.txt");
const fixtureBig = join(fixtures, "ai-oversize.png");
await writeFile(fixturePng, PNG_1PX);
await writeFile(fixturePng2, PNG_1PX);
await writeFile(fixtureTxt, "not an image\n");
await writeFile(fixtureBig, Buffer.alloc(5 * 1024 * 1024 + 1));

const PROBE = `(() => {
  const q = (s) => document.querySelector(s);
  const cs = (el) => el ? getComputedStyle(el) : null;
  const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
  const motif = q('.ai-motif svg');
  const aiLink = q('.chNav a[href="/tim-kiem-ai"]');
  return {
    viewport: innerWidth + 'x' + innerHeight, theme: document.documentElement.getAttribute('data-theme'),
    header: !!q('.chHeader'), aiCurrent: aiLink?.getAttribute('aria-current'),
    oldHeader: !!q('.sfPromo, .sfHeader, .sfSearch, .stStudio, .stStudioPanel'),
    noB2: !q('.hmCanvas'),
    title: q('#search-title')?.textContent,
    mains: document.querySelectorAll('main').length,
    aiPageTag: q('.aiPage')?.tagName ?? null,
    hintCS: { marginBottom: cs(q('.mode-hint'))?.marginBottom, lineHeight: cs(q('.mode-hint'))?.lineHeight, fontSize: cs(q('.mode-hint'))?.fontSize },
    inputPadX: [cs(q('.ai-input'))?.paddingLeft, cs(q('.ai-input'))?.paddingRight],
    outputPadX: [cs(q('.ai-output'))?.paddingLeft, cs(q('.ai-output'))?.paddingRight],
    headingFont: cs(q('.examples-heading h2'))?.fontSize,
    mainCaptionFont: cs(q('.example-main .example-caption'))?.fontSize,
    otherCaptionFont: [...document.querySelectorAll('.example-caption')][1] ? cs([...document.querySelectorAll('.example-caption')][1])?.fontSize : null,
    boardCols: cs(q('.examples-board'))?.gridTemplateColumns,
    captionCS: { direction: cs(q('.example-caption'))?.flexDirection, align: cs(q('.example-caption'))?.alignItems, gap: cs(q('.example-caption'))?.gap },
    useCS: { display: cs(q('.example-use'))?.display, gap: cs(q('.example-use'))?.gap, verbFont: cs(q('.use-verb'))?.fontSize, verbWrap: cs(q('.use-verb'))?.whiteSpace },
    h1: q('.ai-input h1')?.textContent,
    modes: [...document.querySelectorAll('.mode-switch button')].map((b) => ({ text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed') })),
    hint: q('.mode-hint')?.textContent,
    textarea: !!q('#ai-query'), submit: q('.search-submit')?.textContent?.trim(),
    guestNote: q('.panel-note')?.textContent?.trim().slice(0, 80) ?? null,
    motif: motif ? { w: rect(q('.ai-motif')).w, h: rect(q('.ai-motif')).h, paths: [...motif.querySelectorAll('path')].map((p) => p.getAttribute('d')), viewBox: motif.getAttribute('viewBox') } : null,
    shell: rect(q('.ai-shell')), input: rect(q('.ai-input')), output: rect(q('.ai-output')), board: rect(q('.examples-board')),
    inputBg: cs(q('.ai-input'))?.backgroundColor,
    tokens: { canvas: cs(q('.hmPalette'))?.getPropertyValue('--st-canvas').trim(), ink: cs(q('.hmPalette'))?.getPropertyValue('--st-ink').trim(), select: cs(q('.hmPalette'))?.getPropertyValue('--st-select').trim() },
    examples: [...document.querySelectorAll('.search-example')].map((b) => ({ title: b.querySelector('.example-caption span')?.textContent, pressed: b.getAttribute('aria-pressed') })),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`;

await (async () => {
  const proc = await launch(9412, "/tmp/ai-r2");
  try {
    const p = await newPage(9412);
    await p.setViewport(1440, 1000);
    await p.send("Network.setCacheDisabled", { cacheDisabled: true });

    // ---------- Layout / reference geometry + responsive / theme ----------
    const layouts = {
      "1440": { inputW: 392, boardH: 540, prominence: "2col" },
      "1024": { inputW: 330, boardH: 480, prominence: "2col" },
      "768": { inputW: 330, boardH: 480, prominence: "2col" },
      "390": { inputW: 390, boardH: 360, prominence: "stack" },
      "320": { inputW: 320, boardH: 480, prominence: "stack" },
    };
    for (const scheme of ["light", "dark"]) {
      await p.setColorScheme(scheme);
      for (const [w, h] of [[1440, 1000], [1024, 900], [768, 900], [390, 844], [320, 780]]) {
        await p.setViewport(w, h);
        await p.goto(`${base}/tim-kiem-ai`);
        const x = await p.eval(PROBE);
        const exp = layouts[w];
        record(`AI ${scheme} @${w}: header Customer active AI, không còn pilot/không B2, palette đúng`,
          x.header && x.aiCurrent === "page" && !x.oldHeader && x.noB2
            && x.tokens.canvas === (scheme === "light" ? "#fbfaf7" : "#08090b")
            && x.tokens.ink === (scheme === "light" ? "#1b1c1a" : "#edeef0")
            && x.tokens.select === (scheme === "light" ? "#f1f0ea" : "#17181b"),
          JSON.stringify({ header: x.header, current: x.aiCurrent, old: x.oldHeader, noB2: x.noB2, tokens: x.tokens }));
        record(`AI ${scheme} @${w}: đúng cấu trúc Tìm đồ + 3 mode + motif signature`,
          x.h1 === "Tìm đồ" && x.modes.length === 3 && x.modes[0].pressed === "true"
            && x.textarea && x.submit === "Tìm kiếm"
            && x.motif && x.motif.w === 48 && x.motif.h === 48 && x.motif.viewBox === "0 0 48 48"
            && JSON.stringify(x.motif.paths) === JSON.stringify(["M4 4H32", "M32 4H44", "M44 4V44"]),
          JSON.stringify({ h1: x.h1, modes: x.modes, motif: x.motif }));
        const layoutOk = w === 768 || w === 320
          ? (exp.prominence === "stack" ? Math.abs(x.input.w - w) <= 1 && x.shell.h > x.input.h : Math.abs(x.input.w - exp.inputW) <= 1)
          : Math.abs(x.input.w - exp.inputW) <= 1;
        record(`AI ${scheme} @${w}: layout responsive khớp nguồn (input ${exp.inputW}, board ${exp.boardH}, không tràn)`,
          layoutOk && Math.abs(x.board.h - exp.boardH) <= 1.5 && x.overflow <= 1,
          JSON.stringify({ input: x.input, board: x.board, overflow: x.overflow }));
        record(`AI ${scheme} @${w}: một main duy nhất, cascade mode-hint/example final`,
          x.mains === 1 && x.aiPageTag === "DIV"
            && x.hintCS.marginBottom === "18px" && x.hintCS.lineHeight === "20.15px"
            && x.useCS.display === "flex" && x.useCS.gap === "6px"
            && x.useCS.verbFont === "12px" && x.useCS.verbWrap === "nowrap"
            && (w <= 1100
              ? x.captionCS.direction === "column" && x.captionCS.align === "flex-start" && x.captionCS.gap === "2px"
              : x.captionCS.direction === "row")
            && (w > 480 || (x.inputPadX.every((v) => v === "16px") && x.outputPadX.every((v) => v === "16px")
              && x.headingFont === "22px" && x.mainCaptionFont === "16px" && x.otherCaptionFont === "13px"
              && (() => { const cols = (x.boardCols ?? "").split(" ").map(parseFloat); return cols.length === 2 && Math.abs(cols[0] / cols[1] - 1.15 / 0.9) < 0.02; })())),
          JSON.stringify({ mains: x.mains, tag: x.aiPageTag, hint: x.hintCS, caption: x.captionCS, use: x.useCS, padX: x.inputPadX, heading: x.headingFont, mainFont: x.mainCaptionFont, otherFont: x.otherCaptionFont, cols: x.boardCols }));
        await p.shot(join(shots, `ai-${w}-${scheme}.png`));
      }
    }

    // ---------- Pending placeholders at 320/390 (no overflow, both themes) ----------
    for (const scheme of ["light", "dark"]) {
      await p.setColorScheme(scheme);
      for (const [w, h] of [[390, 844], [320, 780]]) {
        await p.setViewport(w, h);
        await p.goto(`${base}/tim-kiem-ai?preview=pending`);
        const pending = await p.eval(`(() => {
          const out = document.querySelector('.ai-output').getBoundingClientRect();
          const cards = [...document.querySelectorAll('.skeleton-card')].map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, w: r.width, right: r.right, h: r.height }; });
          return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, out: { x: out.x, w: out.width, right: out.right }, cards };
        })()`);
        record(`AI pending ${scheme} @${w}: skeleton theo cột kết quả, không tràn ngang`,
          pending.overflow <= 1 && pending.cards.length === 2
            && pending.cards.every((c) => c.right <= pending.out.right + 0.5 && c.w <= pending.out.w + 0.5 && c.h > 0),
          JSON.stringify(pending));
        await p.shot(join(shots, `ai-pending-${w}-${scheme}.png`));
      }
    }

    // ---------- Preview states (mock only, no AI calls) ----------
    await p.setColorScheme("light");
    await p.setViewport(1440, 1000);
    const previewBase = p.aiRequests().length;
    const stateProbe = `(() => {
      const q = (s) => document.querySelector(s);
      return {
        preview: q('.preview-note')?.textContent?.trim() ?? null,
        heading: q('.results-head h2')?.textContent ?? null,
        status: q('.search-status')?.textContent ?? null,
        alert: q('.status')?.textContent ?? null,
        empty: q('.empty-state h3')?.textContent ?? null,
        cards: document.querySelectorAll('.result-card').length,
        skeleton: document.querySelectorAll('.skeleton-card').length,
        zoom: document.querySelectorAll('.result-image-button').length,
        fail: document.querySelectorAll('.result-image-fail').length,
        examples: document.querySelectorAll('.search-example').length,
        links: [...document.querySelectorAll('.state-actions a')].map((a) => a.getAttribute('href')),
        submitDisabled: q('.search-submit')?.disabled ?? null,
        raw: [...document.querySelectorAll('.raw-score strong')].map((s) => s.textContent),
      };
    })()`;
    const previewExpect = {
      idle: { examples: 3 },
      pending: { heading: "Kết quả", status: "Đang tìm…", skeleton: 2 },
      results: { heading: "Kết quả", cards: 2, zoom: 2, raw: ["0.873", "0.812"] },
      empty: { heading: "Kết quả", empty: "Không có kết quả" },
      error: { heading: "Kết quả", alert: /Không thể tìm kiếm/ },
      session: { heading: "Kết quả", alert: /Phiên đăng nhập/, links: ["/dang-nhap?next=/tim-kiem-ai"] },
      forbidden: { heading: "Kết quả", alert: /không có quyền/, links: ["/tai-khoan"] },
      imagefail: { heading: "Kết quả", cards: 2, fail: 2, zoom: 0 },
    };
    for (const [name, exp] of Object.entries(previewExpect)) {
      await p.goto(`${base}/tim-kiem-ai?preview=${name}`);
      const s = await p.eval(stateProbe);
      const ok = s.preview?.includes(`?preview=${name}`) && s.submitDisabled === true
        && (exp.examples === undefined || s.examples === exp.examples)
        && (exp.heading === undefined || s.heading === exp.heading)
        && (exp.status === undefined || s.status === exp.status)
        && (exp.skeleton === undefined || s.skeleton === exp.skeleton)
        && (exp.cards === undefined || s.cards === exp.cards)
        && (exp.zoom === undefined || s.zoom === exp.zoom)
        && (exp.fail === undefined || s.fail === exp.fail)
        && (exp.empty === undefined || s.empty === exp.empty)
        && (exp.alert === undefined || exp.alert.test(s.alert ?? ""))
        && (exp.links === undefined || JSON.stringify(s.links) === JSON.stringify(exp.links))
        && (exp.raw === undefined || JSON.stringify(s.raw) === JSON.stringify(exp.raw));
      record(`AI preview ${name}: trạng thái mock đúng, không gọi AI`, ok, JSON.stringify(s));
      await p.shot(join(shots, `ai-preview-${name}-1440.png`));
    }
    record("AI mock: toàn bộ preview không phát sinh request AI", p.aiRequests().length === previewBase, `${previewBase} → ${p.aiRequests().length}`);

    // ---------- Zoom (preview results) ----------
    await p.goto(`${base}/tim-kiem-ai?preview=results`);
    const fixture = await p.eval(`(() => {
      const card = document.querySelector('.result-card');
      const img = card.querySelector('.result-image');
      return {
        title: card.querySelector('.result-copy h3')?.textContent,
        alt: img?.getAttribute('alt'),
        src: img?.getAttribute('src'),
        fit: img ? getComputedStyle(img).objectFit : null,
        transform: img ? getComputedStyle(img).transform : null,
        credit: card.querySelector('.result-details')?.textContent ?? "",
      };
    })()`);
    record("AI fixture: kết quả 'Áo khoác đen' dùng ảnh editorial bomber + credit đúng nguồn",
      fixture.title === "Áo khoác đen"
        && /áo khoác/i.test(fixture.alt ?? "")
        && (fixture.src ?? "").includes("photo-1554201277-9e2c0d5bcd39")
        && fixture.fit === "contain" && fixture.transform === "none"
        && /Joel Barwick/.test(fixture.credit),
      JSON.stringify(fixture));
    await p.eval(`document.querySelector('.result-image-button').focus()`);
    await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r" });
    await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await sleep(250);
    const zoom = await p.eval(`(() => { const d = document.querySelector('.ai-dialog'); const img = d.querySelector('.ai-dialog-media img'); return { open: d.open, title: document.querySelector('#ai-dialog-title')?.textContent, inDialog: d.contains(document.activeElement), alt: img?.getAttribute('alt'), src: img?.getAttribute('src') }; })()`);
    await p.shot(join(shots, "ai-zoom-open-1440.png"));
    await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await sleep(250);
    const zoomClosed = await p.eval(`(() => ({ open: document.querySelector('.ai-dialog').open, returned: document.activeElement === document.querySelector('.result-image-button') }))()`);
    record("AI zoom: Enter mở dialog đúng ảnh editorial, Escape đóng và trả focus về ảnh",
      zoom.open && zoom.inDialog && zoom.title === "Xem ảnh" && /áo khoác/i.test(zoom.alt ?? "")
        && (zoom.src ?? "").includes("photo-1554201277-9e2c0d5bcd39")
        && !zoomClosed.open && zoomClosed.returned,
      JSON.stringify({ zoom, zoomClosed }));

    // ---------- Examples + guest validation/live (no AI call) ----------
    await p.goto(`${base}/tim-kiem-ai`);
    const beforeExamples = p.aiRequests().length;
    await p.eval(`document.querySelector('.search-example.example-main').click()`);
    await sleep(300);
    const example = await p.eval(`(() => ({ value: document.querySelector('#ai-query')?.value, focus: document.activeElement?.id, cards: document.querySelectorAll('.result-card').length, examples: document.querySelectorAll('.search-example').length, pressed: document.querySelector('.search-example.example-main')?.getAttribute('aria-pressed') }))()`);
    record("AI example: chỉ điền textarea + focus, không tự tìm/gọi AI",
      example.value === "Áo thun đen, dáng rộng, phối quần jeans" && example.focus === "ai-query"
        && example.cards === 0 && example.examples === 3 && example.pressed === "true"
        && p.aiRequests().length === beforeExamples,
      JSON.stringify(example));

    await p.eval(`document.querySelector('.search-submit').click()`); await sleep(1200);
    const guest = await p.eval(`(() => ({ alert: document.querySelector('.status')?.textContent, login: document.querySelector('.state-actions a')?.getAttribute('href'), value: document.querySelector('#ai-query')?.value }))()`);
    record("AI live guest: báo cần đăng nhập thật, giữ input, không gọi AI",
      /Cần đăng nhập/.test(guest.alert ?? "") && guest.login === "/dang-nhap?next=/tim-kiem-ai"
        && guest.value === "Áo thun đen, dáng rộng, phối quần jeans" && p.aiRequests().length === beforeExamples,
      JSON.stringify(guest));

    await p.eval(`(() => { const t = document.querySelector('#ai-query'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, ''); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await p.eval(`document.querySelector('.search-submit').click()`); await sleep(300);
    const validation = await p.eval(`(() => ({ error: document.querySelector('.panel-error')?.textContent, invalid: document.querySelector('#ai-query')?.getAttribute('aria-invalid'), focus: document.activeElement?.id }))()`);
    record("AI validation: mô tả rỗng báo lỗi tại field, aria-invalid + focus",
      /Nhập từ khóa/.test(validation.error ?? "") && validation.invalid === "true" && validation.focus === "ai-query",
      JSON.stringify(validation));

    // ---------- Mobile result cascade (<=480) ----------
    await p.setViewport(390, 844);
    await p.goto(`${base}/tim-kiem-ai?preview=results`);
    const mobileResults = await p.eval(`(() => {
      const q = (s) => document.querySelector(s);
      const cs = (el) => getComputedStyle(el);
      return {
        gap: cs(q('.results-grid')).columnGap,
        title: cs(q('.result-copy h3')).fontSize,
        copyDisplay: cs(q('.result-copy')).display,
        copyTop: cs(q('.result-copy')).paddingTop,
        rawDisplay: cs(q('.raw-score')).display,
        rawTop: cs(q('.raw-score')).marginTop,
        zoom: [q('.image-zoom').getBoundingClientRect().width, q('.image-zoom').getBoundingClientRect().height],
      };
    })()`);
    record("AI result cascade @390: gap14/title14/raw block/zoom32 theo final <=480",
      mobileResults.gap === "14px" && mobileResults.title === "14px" && mobileResults.copyDisplay === "block"
        && mobileResults.copyTop === "11px" && mobileResults.rawDisplay === "block" && mobileResults.rawTop === "4px"
        && mobileResults.zoom[0] === 32 && mobileResults.zoom[1] === 32,
      JSON.stringify(mobileResults));
    await p.shot(join(shots, "ai-results-390-light.png"));

    // ---------- Upload select/replace/remove/validation ----------
    await p.goto(`${base}/tim-kiem-ai`);
    await p.eval(`[...document.querySelectorAll('.mode-switch button')][1].click()`); await sleep(200);
    await p.setFile("#ai-file", fixturePng);
    const selected = await p.eval(`(() => { const q = (s) => document.querySelector(s); return { compact: !!q('.reference-compact'), name: q('.reference-meta .file-name')?.textContent, blob: q('.reference-thumb')?.getAttribute('src')?.startsWith('blob:'), actions: [...document.querySelectorAll('.reference-actions button')].map((b) => b.textContent.trim()), error: q('.panel-error')?.textContent ?? null }; })()`);
    record("AI upload: chọn ảnh → preview contain + tên + Thay/Xóa, không lỗi",
      selected.compact && selected.name === "ai-fixture.png" && selected.blob
        && selected.actions.includes("Thay ảnh") && selected.actions.includes("Xóa") && !selected.error,
      JSON.stringify(selected));
    await p.shot(join(shots, "ai-upload-390.png"));
    await p.setFile("#ai-file", fixturePng2);
    const replaced = await p.eval(`document.querySelector('.reference-meta .file-name')?.textContent`);
    record("AI upload: thay ảnh cập nhật tên preview", replaced === "ai-fixture-2.png", replaced ?? "null");
    await p.eval(`[...document.querySelectorAll('.reference-actions button')].find((b) => b.textContent.includes('Xóa'))?.click()`);
    await sleep(250);
    const removed = await p.eval(`(() => ({ upload: !!document.querySelector('.upload-select'), compact: !!document.querySelector('.reference-compact'), value: document.querySelector('#ai-file')?.value }))()`);
    record("AI upload: xóa ảnh trả về ô chọn, clear input", removed.upload && !removed.compact && removed.value === "", JSON.stringify(removed));
    await p.setFile("#ai-file", fixtureTxt);
    const wrongType = await p.eval(`({ error: document.querySelector('.panel-error')?.textContent, compact: !!document.querySelector('.reference-compact') })`);
    record("AI upload: sai định dạng bị chặn tại field", /JPEG\/PNG/.test(wrongType.error ?? "") && !wrongType.compact, JSON.stringify(wrongType));
    await p.setFile("#ai-file", fixtureBig);
    const oversize = await p.eval(`({ error: document.querySelector('.panel-error')?.textContent, compact: !!document.querySelector('.reference-compact') })`);
    record("AI upload: >5MiB bị chặn tại field", /5MiB/.test(oversize.error ?? "") && !oversize.compact, JSON.stringify(oversize));

    // ---------- Mode/input retention ----------
    await p.goto(`${base}/tim-kiem-ai`);
    await p.eval(`(() => { const t = document.querySelector('#ai-query'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, 'Áo khoác đen'); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await p.eval(`[...document.querySelectorAll('.mode-switch button')][1].click()`); await sleep(150);
    await p.eval(`[...document.querySelectorAll('.mode-switch button')][2].click()`); await sleep(150);
    const retained = await p.eval(`document.querySelector('#ai-query')?.value`);
    record("AI mode switch: giữ mô tả đã nhập (safe retention)", retained === "Áo khoác đen", retained ?? "null");

    // ---------- Candidate Home regression + isolation ----------
    await p.setViewport(1440, 1000);
    await p.goto(`${base}/`);
    const home = await p.eval(`(() => { const q = (s) => document.querySelector(s); const l = q('.hmCanvas'); return { header: !!q('.chHeader'), hmHome: !!q('.hmHome'), b2: l?.dataset.fit ?? null, canvas: q('.hmPalette') ? getComputedStyle(q('.hmPalette')).getPropertyValue('--st-canvas').trim() : null, aiPage: !!q('.aiPage') }; })()`);
    record("AI isolation: candidate Home vẫn header/palette/B2, không lẫn AI page",
      home.header && home.hmHome && home.b2 === "visible" && home.canvas === "#fbfaf7" && !home.aiPage,
      JSON.stringify(home));

    // ---------- 200% zoom proxy + mobile menu header ----------
    await p.setViewport(640, 900);
    await p.goto(`${base}/tim-kiem-ai`);
    const zoomProxy = await p.eval(`(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, modes: document.querySelectorAll('.mode-switch button').length, submit: !!document.querySelector('.search-submit') }))()`);
    record("AI 640px reflow proxy (200% zoom): không tràn, controls còn dùng được", zoomProxy.overflow <= 1 && zoomProxy.modes === 3 && zoomProxy.submit, JSON.stringify(zoomProxy));

    await p.setViewport(390, 844);
    await p.goto(`${base}/tim-kiem-ai`);
    await p.eval(`document.querySelector('.chMobile > summary').focus()`);
    await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r" });
    await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await sleep(200);
    const menu = await p.eval(`(() => { const d = document.querySelector('.chMobile'); return { open: d.open, aiCurrent: d.querySelector('a[href="/tim-kiem-ai"]')?.getAttribute('aria-current'), cart: document.querySelector('.chCartCount')?.textContent }; })()`);
    record("AI header mobile: Menu mở được, AI current đúng, cart thật hiển thị", menu.open && menu.aiCurrent === "page" && menu.cart === "0", JSON.stringify(menu));

    await writeFile(join(outDir, "ai-search-report.json"), JSON.stringify(results, null, 2));
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} pass · ảnh: ${shots}`);
    process.exit(failed.length === 0 ? 0 : 1);
  } finally {
    proc.kill();
  }
})();
