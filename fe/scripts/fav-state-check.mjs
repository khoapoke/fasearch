// Kiểm tra trạng thái "đã yêu thích" trên route NGOÀI pilot — đúng cách repro của Review
// (SPEC-13): bấm trái tim (yêu thích lưu ở localStorage, KHÔNG ghi dữ liệu máy chủ),
// rồi so màu hiển thị giữa baseline 3108 và ứng viên 3109.
//
// Dùng: node scripts/fav-state-check.mjs <baselineUrl> <candidateUrl> <outFile>
// Không gọi API ghi, không đổi dữ liệu server.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = process.env.CHROME_BIN
  || "/home/dolakhoa/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome";
const ROUTES = ["/hang-moi", "/nu", "/nam", "/sale", "/catalog"];
const [baseline, candidate, outFile] = process.argv.slice(2);
if (!baseline || !candidate || !outFile) {
  console.error("dùng: node scripts/fav-state-check.mjs <baselineUrl> <candidateUrl> <outFile>");
  process.exit(1);
}

async function pressFav(port, url) {
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
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
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
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text ?? "eval lỗi");
    return r.result?.value;
  };
  try {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.navigate", { url });
    await sleep(1600);
    return await evaluate(`(async () => {
      const btn = document.querySelector(".pFav");
      if (!btn) return { ok: false, reason: "không thấy nút yêu thích" };
      const before = getComputedStyle(btn).color;
      btn.click();
      await new Promise((r) => setTimeout(r, 400));
      const after = getComputedStyle(btn).color;
      const pressed = btn.getAttribute("aria-pressed");
      return { ok: true, before, after, pressed, count: document.querySelectorAll(".pFav").length };
    })()`);
  } finally {
    ws.close();
  }
}

async function withBrowser(port, profile, fn) {
  const proc = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 80; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) break;
    } catch { /* chưa lên */ }
    await sleep(150);
  }
  try {
    return await fn();
  } finally {
    proc.kill();
  }
}

const out = { checkedAt: new Date().toISOString(), baseline, candidate, routes: [] };
for (const route of ROUTES) {
  const base = await withBrowser(9401, `/tmp/fav-base${route.replace(/\W/g, "")}`, () => pressFav(9401, baseline + route));
  const cand = await withBrowser(9402, `/tmp/fav-cand${route.replace(/\W/g, "")}`, () => pressFav(9402, candidate + route));
  // Không có nút yêu thích ở cả hai bên -> coi như giống nhau.
  const same = base?.after === cand?.after;
  out.routes.push({ route, baseline: base, candidate: cand, sameColor: !!same });
  const note = base?.after === undefined ? " (không có nút yêu thích)" : "";
  console.log(`${route}: baseline ${base?.after} | ứng viên ${cand?.after}${note} | ${same ? "GIỐNG NHAU ✓" : "KHÁC NHAU ✗"}`);
}
out.sameOnAllRoutes = out.routes.every((r) => r.sameColor);
out.criterion = "route NGOÀI pilot phải khớp baseline 100%; route pilot được phép khác (màu thương hiệu theo DESIGN §2)";
out.nonPilotSame = out.routes.filter((r) => r.route !== "/nam").every((r) => r.sameColor);
out.pilotIntentional = out.routes.filter((r) => r.route === "/nam").map((r) => ({
  route: r.route, baseline: r.baseline?.after, candidate: r.candidate?.after,
  note: "là bề mặt PILOT: màu thương hiệu Ultramarine theo DESIGN §2 — khác baseline một cách CỐ Ý",
}));
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(out, null, 2));
console.log(`\nRoute NGOÀI pilot: ${out.nonPilotSame ? "khớp baseline 100% ✓" : "CÓ route lệch ✗"} · `
  + `route pilot: màu thương hiệu theo DESIGN (khác baseline một cách cố ý). Ghi: ${outFile}`);
process.exit(out.nonPilotSame ? 0 : 1);
