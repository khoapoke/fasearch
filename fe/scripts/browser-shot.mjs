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

async function shoot(session, spec, outDir) {
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: spec.width ?? 1280,
    height: spec.height ?? 900,
    deviceScaleFactor: 1,
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
    .slice(0, 6);

  let shot;
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
  return { name, ...metrics, errors };
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
console.log(JSON.stringify(results.map((r) => ({ name: r.name, overflowPx: r.overflowPx, errors: (r.errors ?? []).length, wide: r.wide?.length ?? 0 })), null, 1));
proc.kill();
process.exit(0);
