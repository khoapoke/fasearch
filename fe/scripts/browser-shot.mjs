// Công cụ chụp ảnh kiểm chứng UI: điều khiển Chrome qua CDP bằng WebSocket sẵn có
// của Node 22 (không thêm dependency). Dùng cho evidence Wave6: ảnh đã đăng nhập,
// lỗi console, kiểm tra tràn ngang.
//
// Cách dùng:
//   node scripts/browser-shot.mjs <baseUrl> <outDir> <specFile.json>
// spec: [{ name, url, width, height, role, fullPage }]
// role: "guest" | "customer" | "staff" | "admin" — đăng nhập qua /api/auth/login.

import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = process.env.CHROME_BIN
  || "/home/dolakhoa/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome";
const PORT = Number(process.env.CDP_PORT || 9223);

const ACCOUNTS = {
  customer: { user: "emiluix-cust", pass: "Cst-20261020" },
  staff: { user: "emiluix-staff", pass: "Stf-20261020" },
  admin: { user: "emiluix-admin", pass: "Adm-20261020" },
};

async function launch() {
  const proc = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`, "--user-data-dir=/tmp/cdp-profile-uiux",
    "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return proc;
    } catch { /* chưa sẵn sàng */ }
    await sleep(250);
  }
  proc.kill();
  throw new Error("Chrome CDP không khởi động");
}

async function newTarget() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
  return res.json();
}

class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
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
    const res = await this.send("Runtime.evaluate", {
      expression, awaitPromise: true, returnByValue: true,
    });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.text ?? "eval lỗi");
    return res.result?.value;
  }
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  return new Session(ws);
}

async function login(base, role) {
  const account = ACCOUNTS[role];
  if (!account) return [];
  const csrf = await fetch(`${base}/api/auth/csrf`);
  const csrfJson = await csrf.json();
  const header = csrfJson.result.headerName;
  const token = csrfJson.result.token;
  // CSRF token gắn với session; phải mang cookie phiên sang lệnh login.
  const csrfCookies = (csrf.headers.getSetCookie?.() ?? []).map((raw) => raw.split(";")[0]);
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [header]: token,
      ...(csrfCookies.length ? { cookie: csrfCookies.join("; ") } : {}),
    },
    body: JSON.stringify({ username: account.user, password: account.pass }),
  });
  if (!res.ok) throw new Error(`đăng nhập ${role} thất bại: HTTP ${res.status}`);
  const setCookie = res.headers.getSetCookie?.() ?? [];
  return setCookie.map((raw) => raw.split(";")[0]);
}

// Điều hướng trong trang làm mất execution context: bước sau báo "không
// chạy được" thay vì làm hỏng cả chuỗi bước.
async function safeEval(session, expression) {
  try {
    return await session.eval(expression);
  } catch {
    return null;
  }
}

async function runSteps(session, steps) {
  const log = [];
  for (const step of steps ?? []) {
    if (step.wait) {
      await sleep(step.wait);
      log.push(`wait ${step.wait}ms`);
      continue;
    }
    if (step.fill) {
      const ok = await safeEval(session, `(() => {
        const el = document.querySelector(${JSON.stringify(step.fill)});
        if (!el) return false;
        const proto = el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, ${JSON.stringify(step.value ?? "")});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      log.push(`fill ${step.fill} -> ${ok}`);
      continue;
    }
    if (step.click) {
      const res = await safeEval(session, `(() => {
        const sel = ${JSON.stringify(step.click)};
        const all = [...document.querySelectorAll('button, a, [role=button]')];
        const norm = (n) => (n.textContent || '').trim().toLowerCase();
        let el = all.find((n) => norm(n) === sel.toLowerCase());
        if (!el) el = all.find((n) => norm(n).includes(sel.toLowerCase()));
        if (!el) return { ok: false, why: 'không tìm thấy phần tử' };
        el.scrollIntoView({ block: 'center' });
        el.click();
        return { ok: true, tag: el.tagName, text: (el.textContent || '').trim().slice(0, 40) };
      })()`);
      log.push(`click ${step.click} -> ${JSON.stringify(res)}`);
      await sleep(step.after ?? 700);
      continue;
    }
    if (step.tab) {
      // Điều hướng bằng bàn phím: Tab thật (Input.dispatchKeyEvent) rồi đọc
      // phần tử đang có focus để kiểm tra thứ tự tab và nhãn truy cập.
      const seen = [];
      for (let i = 0; i < (step.tab ?? 0); i += 1) {
        await session.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
        await session.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
        await sleep(60);
        const label = await safeEval(session, `(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return 'body';
          const text = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || el.value || el.tagName).trim();
          const visible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
          return el.tagName + ':' + text.slice(0, 24) + (visible ? '' : ' [ẩn]');
        })()`);
        seen.push(label);
      }
      log.push(`tab ${step.tab} -> ${JSON.stringify(seen)}`);
      continue;
    }
    if (step.eval) {
      const value = await safeEval(session, step.eval);
      log.push(`eval -> ${JSON.stringify(value)}`);
      continue;
    }
    if (step.select) {
      const ok = await safeEval(session, `(() => {
        const el = document.querySelector(${JSON.stringify(step.select)});
        if (!el) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(step.value ?? "")});
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`);
      log.push(`select ${step.select}=${step.value} -> ${ok}`);
      await sleep(step.after ?? 700);
      continue;
    }
    if (step.file) {
      const { root } = await session.send("DOM.getDocument", { depth: 1 });
      const { nodeId } = await session.send("DOM.querySelector", {
        nodeId: root.nodeId, selector: step.file,
      });
      if (!nodeId) {
        log.push(`file ${step.file} -> không tìm thấy input`);
      } else {
        await session.send("DOM.setFileInputFiles", { files: [step.filePath], nodeId });
        log.push(`file ${step.file} -> ${step.filePath}`);
        await sleep(step.after ?? 800);
      }
      continue;
    }
    if (step.expect) {
      const found = await safeEval(session, `(() => {
        const text = document.body.innerText || '';
        const needle = ${JSON.stringify(step.expect)};
        return text.toLowerCase().includes(needle.toLowerCase());
      })()`);
      log.push(`expect ${step.expect} -> ${found}`);
      continue;
    }
  }
  return log;
}

async function shoot(session, spec, outDir) {
  // Mô phỏng media feature (ví dụ prefers-reduced-motion: reduce) để kiểm
  // chuyển động bị tắt nhưng phản hồi opacity vẫn còn.
  if (spec.media) {
    await session.send("Emulation.setEmulatedMedia", {
      features: [{ name: spec.media.name, value: spec.media.value }],
    });
  }
  // zoom: mô phỏng phóng to bằng cách thu nhỏ khung nhìn + deviceScaleFactor.
  const scale = spec.zoom ?? 1;
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: Math.round((spec.width ?? 1280) / scale),
    height: Math.round((spec.height ?? 900) / scale),
    deviceScaleFactor: scale,
    mobile: (spec.width ?? 1280) < 700,
  });
  const loaded = new Promise((resolve) => {
    const timer = setInterval(() => {
      if (session.events.some((e) => e.method === "Page.loadEventFired")) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
    setTimeout(() => { clearInterval(timer); resolve(); }, 15000);
  });
  await session.send("Page.navigate", { url: spec.url });
  await loaded;
  await sleep(spec.settleMs ?? 1200);
  const stepLog = await runSteps(session, spec.steps);
  if (spec.steps?.length) await sleep(spec.afterStepsMs ?? 900);

  const metrics = await session.eval(`(() => {
    const de = document.documentElement;
    const overflow = de.scrollWidth - de.clientWidth;
    const wide = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > de.clientWidth + 2)
      .slice(0, 5)
      .map((el) => el.tagName + '.' + (el.className || '').toString().split(' ')[0]);
    return {
      title: document.title,
      overflowPx: overflow,
      h1: document.querySelector('h1')?.textContent?.trim() ?? null,
      wide,
    };
  })()`);

  const errors = session.events
    .filter((e) => e.method === "Runtime.consoleAPICalled" && e.params.type === "error")
    .map((e) => e.params.args.map((a) => a.value ?? a.description ?? "").join(" "))
    .concat(session.events
      .filter((e) => e.method === "Runtime.exceptionThrown")
      .map((e) => e.params.exceptionDetails?.exception?.description ?? e.params.exceptionDetails?.text ?? "exception"))
    .slice(0, 6);

  if (spec.fullPage) {
    const { cssContentSize } = await session.send("Page.getLayoutMetrics");
    const height = Math.min(Math.ceil(cssContentSize.height), 6000);
    await session.send("Emulation.setDeviceMetricsOverride", {
      width: spec.width ?? 1280, height, deviceScaleFactor: 1, mobile: false,
    });
    await sleep(400);
  }
  const { data } = await session.send("Page.captureScreenshot", { format: "png" });
  const name = `${spec.name}.png`;
  await writeFile(`${outDir}/${name}`, Buffer.from(data, "base64"));
  if (spec.fullPage) {
    await session.send("Emulation.setDeviceMetricsOverride", {
      width: spec.width ?? 1280, height: spec.height ?? 900, deviceScaleFactor: 1, mobile: false,
    });
  }
  return { name, stepLog, ...metrics, errors };
}

const [base, outDir, specFile] = process.argv.slice(2);
if (!base || !outDir || !specFile) {
  console.error("dùng: node scripts/browser-shot.mjs <baseUrl> <outDir> <spec.json>");
  process.exit(1);
}
await mkdir(outDir, { recursive: true });
const specs = JSON.parse(await readFile(specFile, "utf8"));
const proc = await launch();
const target = await newTarget();
const session = await connect(target.webSocketDebuggerUrl);
await session.send("Page.enable");
await session.send("Runtime.enable");
await session.send("Network.enable");

const results = [];
for (const spec of specs) {
  session.events.length = 0;
  // Đặt lại media feature: emulation của spec trước không được lọt sang spec sau.
  await session.send("Emulation.setEmulatedMedia", { features: [] });
  if (spec.role && spec.role !== "guest") {
    const cookies = await login(base, spec.role);
    await session.send("Network.clearBrowserCookies");
    await session.send("Network.setCookies", {
      cookies: cookies.map((c) => {
        const [name, value] = c.split("=");
        return { name, value, domain: "127.0.0.1", path: "/" };
      }),
    });
  } else {
    await session.send("Network.clearBrowserCookies");
  }
  try {
    results.push(await shoot(session, spec, outDir));
  } catch (e) {
    results.push({ name: spec.name, error: String(e) });
  }
}
await writeFile(`${outDir}/report.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map((r) => ({ name: r.name, overflowPx: r.overflowPx, errors: (r.errors ?? []).length, wide: r.wide?.length ?? 0, steps: r.stepLog })), null, 1));
proc.kill();
process.exit(0);
