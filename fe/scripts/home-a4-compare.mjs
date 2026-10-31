// A4: so sánh route KHÔNG thuộc Home giữa baseline và candidate.
//
// Mục đích: chứng minh thay đổi Home không làm đổi màu/chữ/bố cục của các route
// pilot (AI, danh mục, POS) và trang đăng nhập.
//
// Cách làm: trên mỗi route, thu thập chữ ký phần tử (tag + class + text ngắn) kèm
// màu chữ/nền/cỡ chữ thực tế, rồi so hai bên. Chỉ đọc, không đăng nhập, không ghi.
//
// Dùng: node scripts/home-a4-compare.mjs <baselineUrl> <candidateUrl> <outFile>

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = process.env.CHROME_BIN
  || "/home/dolakhoa/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome";

const ROUTES = ["/tim-kiem-ai", "/nam", "/kenh-ban/pos", "/dang-nhap"];
const [baseline, candidate, outFile] = process.argv.slice(2);
if (!baseline || !candidate || !outFile) {
  console.error("dùng: node scripts/home-a4-compare.mjs <baselineUrl> <candidateUrl> <outFile>");
  process.exit(1);
}

const PROBE = `(() => {
  const parse = (s) => (String(s).match(/rgba?\\(([^)]+)\\)/) || [])[1] ?? "";
  const rows = [];
  const seen = new Map();
  for (const el of document.querySelectorAll("body *")) {
    if (el.offsetParent === null) continue;
    // Bỏ phần tử con bên trong <svg>: màu của chúng lấy từ phần tử cha, và
    // className của SVG là SVGAnimatedString (dễ trùng khoá).
    if (el.ownerSVGElement) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim())
      .map((n) => n.textContent.trim()).join(" ");
    const cs = getComputedStyle(el);
    const cls = (el.getAttribute("class") || "").toString().slice(0, 40);
    const base = el.tagName.toLowerCase() + "|" + cls + "|" + own.slice(0, 24);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const key = base + "#" + n;
    rows.push({
      key,
      color: parse(cs.color),
      bg: parse(cs.backgroundColor),
      border: parse(cs.borderTopColor),
      font: cs.fontSize,
      weight: cs.fontWeight,
      hasText: own.length > 0,
    });
  }
  rows.sort((a, b) => a.key.localeCompare(b.key));
  return {
    theme: document.documentElement.getAttribute("data-theme"),
    count: rows.length,
    rows,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    title: document.title,
  };
})()`;

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

async function capture(port, profile, baseUrl, route, theme) {
  const proc = await launch(port, profile);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
    const target = await res.json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    let id = 0;
    const pending = new Map();
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const { resolve, reject } = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) reject(new Error(m.error.message));
        else resolve(m.result);
      }
    });
    const send = (method, params = {}) => {
      id += 1;
      const i = id;
      return new Promise((resolve, reject) => {
        pending.set(i, { resolve, reject });
        ws.send(JSON.stringify({ id: i, method, params }));
      });
    };
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
    // Lựa chọn theme rõ ràng để hai bên chắc chắn cùng theme (không phụ thuộc localStorage riêng).
    await send("Page.navigate", { url: baseUrl + route });
    await sleep(1800);
    const r = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true, awaitPromise: true });
    ws.close();
    return r.result?.value;
  } finally {
    proc.kill();
  }
}

const out = { baseline, candidate, routes: [] };
let drift = 0;
for (const route of ROUTES) {
  const base = await capture(9401, `/tmp/a4-base${route.replace(/\W/g, "")}`, baseline, route, "light");
  const cand = await capture(9402, `/tmp/a4-cand${route.replace(/\W/g, "")}`, candidate, route, "light");
  const baseMap = new Map((base?.rows ?? []).map((r) => [r.key, r]));
  const diffs = [];
  for (const row of cand?.rows ?? []) {
    const b = baseMap.get(row.key);
    if (!b) continue;
    const fields = ["color", "bg", "border", "font", "weight"].filter((f) => b[f] !== row[f]);
    if (fields.length > 0) diffs.push({ key: row.key.slice(0, 70), fields, base: fields.map((f) => b[f]), cand: fields.map((f) => row[f]) });
  }
  const onlyCand = (cand?.rows ?? []).filter((r) => !baseMap.has(r.key)).length;
  const onlyBase = (base?.rows ?? []).filter((r) => !new Set((cand?.rows ?? []).map((x) => x.key)).has(r.key)).length;
  if (diffs.length > 0) drift += diffs.length;
  out.routes.push({
    route,
    baseCount: base?.count ?? null, candCount: cand?.count ?? null,
    baseOverflow: base?.overflow ?? null, candOverflow: cand?.overflow ?? null,
    baseTitle: base?.title ?? null, candTitle: cand?.title ?? null,
    styleDiffs: diffs.slice(0, 8), styleDiffCount: diffs.length, onlyCand, onlyBase,
  });
  console.log(`${route}: ${diffs.length} khác biệt style · chỉ-candidate ${onlyCand} · chỉ-baseline ${onlyBase} · overflow ${base?.overflow}/${cand?.overflow}`);
  for (const d of diffs.slice(0, 3)) console.log(`   ${d.key} → ${d.fields.join(",")}: ${d.base.join("/")} vs ${d.cand.join("/")}`);
}
out.totalStyleDiffs = drift;
out.unchanged = drift === 0;
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(out, null, 2));
console.log(`\n${out.unchanged ? "KHÔNG đổi" : "CÓ đổi"} ở route ngoài Home (${drift} khác biệt). Ghi: ${outFile}`);
process.exit(out.unchanged ? 0 : 1);
