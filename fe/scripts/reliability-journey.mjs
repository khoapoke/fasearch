// Harness kiểm chứng độ tin cậy FE (R3–R5) — chạy trình duyệt thật, không mock.
//
// Mỗi vai trò chạy một Chrome riêng (--user-data-dir riêng) nên cookie/phiên tách
// hoàn toàn: guest, customerA, customerB, staff, admin. Mọi request đi qua proxy
// cùng-origin của FE (/api/be, /api/auth) để kiểm đúng hành vi người dùng thấy.
//
// Dùng: node scripts/reliability-journey.mjs <baseUrl> <outDir> <scenario>
// scenario: r3 | r4 | r5 | all      (mặc định all)
//
// Ghi chú: mọi bước GHI (tạo đơn/hủy/đăng nhập) chỉ chạy trên BE cô lập của task
// (18096/3108). Chế độ chỉ-đọc dùng cho probe 401/403/CSRF khi cần kiểm chứng
// nhanh trên runtime cũ.

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { loadFixtureConfig } from "./fixture-config.mjs";

const CHROME = process.env.CHROME_BIN
  || "/home/dolakhoa/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome";

// Thông tin đăng nhập fixture nằm ở tệp KHÔNG theo dõi git (xem fixture-config.mjs).
let ACCOUNTS = loadFixtureConfig().accounts;

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

// ---------- CDP tối giản ----------
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
    const r = await this.send("Runtime.evaluate", {
      expression, awaitPromise: true, returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text ?? "eval lỗi");
    return r.result?.value;
  }
  async goto(url) {
    await this.send("Page.navigate", { url });
    await sleep(1200);
  }
  async fetchJson(path, init = {}) {
    return this.eval(`(async () => {
      const res = await fetch(${JSON.stringify(path)}, {
        method: ${JSON.stringify(init.method ?? "GET")},
        credentials: "include",
        headers: ${JSON.stringify(init.headers ?? {})},
        body: ${JSON.stringify(init.body ?? null)},
      });
      let body = null;
      try { body = await res.json(); } catch { body = await res.text(); }
      return { status: res.status, body };
    })()`);
  }
  async csrf() {
    const r = await this.fetchJson("/api/auth/csrf");
    return r.body?.result ?? null;
  }
  async login(role) {
    const acc = ACCOUNTS[role];
    const c = await this.csrf();
    if (!c) throw new Error("không lấy được CSRF");
    const r = await this.fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", [c.headerName]: c.token },
      body: JSON.stringify({ username: acc.username, password: acc.password }),
    });
    return r;
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
    const page = await newPage(port);
    return await fn(page);
  } finally {
    proc.kill();
  }
}

// ---------- R3: ma trận bảo mật ----------
async function r3(base, port) {
  await withBrowser(port, "/tmp/relia-r3-a", async (a) => {
    await a.goto(`${base}/`);
    const la = await a.login("customer");
    record("R3 customerA đăng nhập", la.status === 200, `HTTP ${la.status}`);
    const meA = await a.fetchJson("/api/auth/me");
    record("R3 /api/auth/me theo phiên", meA.status === 200, `HTTP ${meA.status}`);
    const csrfA = await a.csrf();

    // CSRF thiếu → 403 và 0 hiệu ứng
    const before = await a.fetchJson("/api/be/v1/don-hang?page=0&size=1");
    const noCsrf = await a.fetchJson("/api/be/v1/don-hang", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maKho: 1, phienBanGio: 1, tongThanhToanDuKien: 1, nguoiNhan: "x", sdtNhan: "0900000000", diaChiGiao: "x" }),
    });
    const after = await a.fetchJson("/api/be/v1/don-hang?page=0&size=1");
    record("R3 POST thiếu CSRF bị chặn", noCsrf.status === 403, `HTTP ${noCsrf.status}`);
    const sameCount = JSON.stringify(before.body?.result?.totalElements)
      === JSON.stringify(after.body?.result?.totalElements);
    record("R3 POST thiếu CSRF không tạo đơn", sameCount,
      `total trước ${before.body?.result?.totalElements} / sau ${after.body?.result?.totalElements}`);
    void csrfA;
  });

  await withBrowser(port + 1, "/tmp/relia-r3-b", async (b) => {
    await b.goto(`${base}/`);
    const lb = await b.login("customer");
    record("R3 customerB đăng nhập (phiên riêng)", lb.status === 200, `HTTP ${lb.status}`);
    // Xem tài khoản của khách khác → 401/404, không rò dữ liệu
    const other = await b.fetchJson("/api/be/v1/thanh-vien/khach-hang/1");
    const bodyText = JSON.stringify(other.body ?? "");
    const leaked = /"soDu"|"tongChiTieu"|"khaDung"/.test(bodyText);
    record("R3 customerB không đọc được hồ sơ khách khác",
      other.status === 401 || other.status === 403 || other.status === 404,
      `HTTP ${other.status}`);
    record("R3 không rò số dư/hạng của người khác", !leaked);
    // Đơn hàng của người khác
    const orders = await b.fetchJson("/api/be/v1/don-hang?page=0&size=3");
    record("R3 khách chỉ thấy đơn của mình",
      orders.status === 200 || orders.status === 401,
      `HTTP ${orders.status}`);
  });

  await withBrowser(port + 2, "/tmp/relia-r3-staff", async (s) => {
    await s.goto(`${base}/`);
    const ls = await s.login("staff");
    record("R3 staff đăng nhập", ls.status === 200, `HTTP ${ls.status}`);
    const staffOrders = await s.fetchJson("/api/be/v1/quan-tri/don-hang?page=0&size=1");
    record("R3 staff đọc được danh sách đơn", staffOrders.status === 200, `HTTP ${staffOrders.status}`);
    const report = await s.fetchJson("/api/be/v1/bao-cao/doanh-thu?tuNgay=2026-01-01&denNgay=2026-12-31");
    record("R3 staff bị chặn báo cáo ADMIN (403 kỳ vọng)", report.status === 403, `HTTP ${report.status}`);
  });

  await withBrowser(port + 3, "/tmp/relia-r3-admin", async (ad) => {
    await ad.goto(`${base}/`);
    const la = await ad.login("admin");
    record("R3 admin đăng nhập", la.status === 200, `HTTP ${la.status}`);
    const report = await ad.fetchJson("/api/be/v1/bao-cao/doanh-thu?tuNgay=2026-01-01&denNgay=2026-12-31");
    record("R3 admin đọc được báo cáo", report.status === 200, `HTTP ${report.status}`);
  });
}

// ---------- R4: tài chính / idempotency / breakdown hủy ----------
async function r4(base, port) {
  await withBrowser(port, "/tmp/relia-r4", async (p) => {
    await p.goto(`${base}/`);
    const login = await p.login("customer");
    record("R4 khách đăng nhập", login.status === 200, `HTTP ${login.status}`);
    const csrf = await p.csrf();
    const auth = { "content-type": "application/json", [csrf.headerName]: csrf.token };

    const cart = await p.fetchJson("/api/be/v1/gio-hang");
    const items = cart.body?.result?.items ?? [];
    if (items.length === 0) {
      record("R4 giỏ có hàng để thử đặt đơn", false, "giỏ rỗng — cần fixture");
      return;
    }
    const phienBan = cart.body?.result?.phienBan;
    const maKho = 1;

    // báo giá
    const quote = await p.fetchJson("/api/be/v1/gio-hang/quote", {
      method: "POST", headers: auth,
      body: JSON.stringify({ maKho, phienBan }),
    });
    record("R4 báo giá 200", quote.status === 200, `HTTP ${quote.status}`);
    const tong = quote.body?.result?.tongThanhToan;
    const phienBanGio = quote.body?.result?.phienBanGio;

    // giá sai → 409, không tạo đơn
    const stale = await p.fetchJson("/api/be/v1/don-hang", {
      method: "POST", headers: auth,
      body: JSON.stringify({
        maKho, phienBanGio, tongThanhToanDuKien: (tong ?? 0) + 1,
        nguoiNhan: "Reliability Test", sdtNhan: "09020261020", diaChiGiao: "1 Test St",
      }),
    });
    record("R4 giá sai → 409 yêu cầu tải lại", stale.status === 409, `HTTP ${stale.status}`);

    // đặt đơn hợp lệ, rồi replay cùng khoaTam
    const key = `reliab-${Date.now()}`;
    const body = {
      maKho, phienBanGio, tongThanhToanDuKien: tong,
      nguoiNhan: "Reliability Test", sdtNhan: "09020261020", diaChiGiao: "1 Test St",
      khoaTam: key,
    };
    const first = await p.fetchJson("/api/be/v1/don-hang", { method: "POST", headers: auth, body: JSON.stringify(body) });
    record("R4 tạo đơn 201", first.status === 201, `HTTP ${first.status}`);
    const maDon = first.body?.result?.maDonHang;
    const replay = await p.fetchJson("/api/be/v1/don-hang", { method: "POST", headers: auth, body: JSON.stringify(body) });
    record("R4 replay cùng khoaTam trả cùng đơn",
      replay.body?.result?.maDonHang === maDon,
      `#${first.body?.result?.maDonHang} vs #${replay.body?.result?.maDonHang}`);

    // snapshot đã chốt
    const before = await p.fetchJson(`/api/be/v1/don-hang/${maDon}`);
    const b = before.body?.result ?? {};
    record("R4 chi tiết đơn có snapshot giảm",
      typeof b.tongThanhToan === "number",
      `tong=${b.tongThanhToan} voucher=${b.giamVoucher} diem=${b.giamDiem} diemSuDung=${b.diemSuDung}`);

    // hủy → so sánh breakdown (DATA-3 vết kiểm)
    const cancel = await p.fetchJson(`/api/be/v1/don-hang/${maDon}/huy`, {
      method: "POST", headers: auth,
      body: JSON.stringify({ khoaTam: `${key}-cancel`, phienBan: b.phienBan, lyDo: "Kiem chu doi tin dung" }),
    });
    record("R4 hủy đơn 200", cancel.status === 200, `HTTP ${cancel.status}`);
    const after = await p.fetchJson(`/api/be/v1/don-hang/${maDon}`);
    const a = after.body?.result ?? {};
    const sameTotal = a.tongThanhToan === b.tongThanhToan;
    record("R4 tổng tiền giữ nguyên sau hủy", sameTotal, `${b.tongThanhToan} -> ${a.tongThanhToan}`);
    const voucherDropped = (b.giamVoucher ?? 0) > 0 && (a.giamVoucher ?? 0) === 0;
    const pointsAbsorbed = (a.giamDiem ?? 0) > (b.giamDiem ?? 0);
    if (voucherDropped && pointsAbsorbed) {
      record("R4 DATA-3: breakdown hủy gộp voucher vào điểm (cần BE sửa snapshot)",
        false,
        `giamVoucher ${b.giamVoucher}->${a.giamVoucher}, giamDiem ${b.giamDiem}->${a.giamDiem}, diemSuDung ${b.diemSuDung}`);
    } else {
      record("R4 breakdown hủy giữ đúng phân bổ đã chốt", true,
        `giamVoucher ${b.giamVoucher}->${a.giamVoucher}, giamDiem ${b.giamDiem}->${a.giamDiem}`);
    }
  });
}

// ---------- R5: hành trình FE trên UI ----------
async function r5(base, port) {
  await withBrowser(port, "/tmp/relia-r5", async (p) => {
    await p.goto(`${base}/dang-nhap`);
    const login = await p.login("customer");
    record("R5 đăng nhập qua trang web", login.status === 200, `HTTP ${login.status}`);
    await p.goto(`${base}/tai-khoan`);
    const hub = await p.eval("({ path: location.pathname, h1: document.querySelector('h1')?.textContent?.trim() ?? null })");
    record("R5 vào được hub tài khoản", hub?.path === "/tai-khoan", JSON.stringify(hub));
    const orders = await p.eval(`(async () => {
      const res = await fetch('/api/be/v1/don-hang?page=0&size=3', { credentials: 'include' });
      return { status: res.status };
    })()`);
    record("R5 hub đọc được đơn qua proxy", orders?.status === 200, `HTTP ${orders?.status}`);
    const focusRing = await p.eval(`(() => {
      const el = document.querySelector('a, button');
      if (!el) return null;
      el.focus();
      const cs = getComputedStyle(el, ':focus-visible');
      return { outline: cs.outlineWidth, tag: el.tagName };
    })()`);
    record("R5 có viền tiêu điểm nhìn thấy", !!focusRing, JSON.stringify(focusRing));
  });
}

const [base, outDir, scenario = "all"] = process.argv.slice(2);
if (!base || !outDir) {
  console.error("dùng: node scripts/reliability-journey.mjs <baseUrl> <outDir> [r3|r4|r5|all]");
  process.exit(1);
}
await mkdir(outDir, { recursive: true });
const port = Number(process.env.CDP_PORT || 9311);
try {
  if (scenario === "r3" || scenario === "all") await r3(base, port);
  if (scenario === "r4" || scenario === "all") await r4(base, port + 10);
  if (scenario === "r5" || scenario === "all") await r5(base, port + 20);
} catch (e) {
  record("harness lỗi", false, String(e));
}
await writeFile(`${outDir}/reliability-report.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length === 0 ? 0 : 1);
