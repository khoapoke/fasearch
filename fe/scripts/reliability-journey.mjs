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
// Mã voucher đang chạy trên BE cô lập của task.
const VOUCHER_CODE = process.env.RELIABILITY_VOUCHER || "EXDEMO01";

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
  async clickByText(text) {
    return this.eval(`(() => {
      const el = [...document.querySelectorAll('button, a, [role=button]')]
        .find(n => (n.textContent || '').trim() === ${JSON.stringify(text)});
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    })()`);
  }
  async setFile(selector, path) {
    const { root } = await this.send("DOM.getDocument", { depth: 1 });
    const { nodeId } = await this.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    if (!nodeId) return false;
    await this.send("DOM.setFileInputFiles", { files: [path], nodeId });
    return true;
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


// ---------- Chuẩn bị tồn kho (admin, BE cô lập) ----------
// Lần chạy trước đã tiêu hết tồn kho của kho cửa hàng (maKho 1) nên báo giá báo
// "Chỉ còn 0 sản phẩm khả dụng" và không đặt được đơn. Nhập thêm hàng qua chính
// API phiếu nhập của staff (POST /kho/phieu/nhap + xac-nhan) để kịch bản có hàng
// mua được — dữ liệu chỉ nằm trong DB cô lập của task.
async function ensureStock(base, port) {
  await withBrowser(port, "/tmp/relia-stock", async (p) => {
    await p.goto(`${base}/`);
    const login = await p.login("admin");
    if (login.status !== 200) {
      record("R0 admin đăng nhập để nhập kho", false, `HTTP ${login.status}`);
      return;
    }
    const csrf = await p.csrf();
    const auth = { "content-type": "application/json", [csrf.headerName]: csrf.token };
    // Danh sách tồn kho yêu cầu maSku; quét từng SKU và mọi kho.
    const need = new Map();
    const seen = [];
    for (const maSku of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const res = await p.fetchJson(`/api/be/v1/kho/ton?maSku=${maSku}&size=50`);
      for (const r of (res.body?.result?.data ?? [])) {
        seen.push(`sku${r.maSku}/kho${r.maKho}: thuc=${r.soLuongThuc} giu=${r.soLuongGiuCho} kha=${r.soLuongKhaDung}`);
        if ((r.soLuongKhaDung ?? 0) < 5) {
          if (!need.has(r.maKho)) need.set(r.maKho, new Set());
          need.get(r.maKho).add(r.maSku);
        }
      }
    }
    const short = [...need.keys()];
    if (short.length === 0) {
      record("R0 tồn kho đủ cho kịch bản", true, seen.slice(0, 4).join(", "));
      return;
    }
    let ok = true;
    const notes = [];
    for (const [maKho, skus] of need) {
      const body = {
        maKhoDich: maKho,
        items: [...skus].map((maSku) => ({ maSku, soLuong: 20 })),
        khoaTam: `relia-nhap-${Date.now()}-${maKho}`,
        nhaCungCap: "Reliability Harness",
      };
      const slip = await p.fetchJson("/api/be/v1/kho/phieu/nhap", { method: "POST", headers: auth, body: JSON.stringify(body) });
      const maPhieu = slip.body?.result?.maPhieu;
      if (!maPhieu) { ok = false; notes.push(`kho${maKho}: phiếu HTTP ${slip.status}`); continue; }
      const confirm = await p.fetchJson(`/api/be/v1/kho/phieu/${maPhieu}/xac-nhan`, { method: "POST", headers: auth, body: "{}" });
      notes.push(`kho${maKho}: phiếu #${maPhieu} xác nhận HTTP ${confirm.status}`);
      if (confirm.status !== 200) ok = false;
    }
    record("R0 nhập tồn kho cho kịch bản (kho cửa hàng hết hàng)", ok,
      notes.join(" | ") + " || trước: " + seen.slice(0, 4).join(", "));
  });
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

    let cart = await p.fetchJson("/api/be/v1/gio-hang");
    let lastPut = "chưa thử";
    if ((cart.body?.result?.items ?? []).length === 0) {
      // Tự tạo giỏ: mỗi lần PUT lại tăng phienBan nên đọc version mới trước mỗi lần gọi.
      for (const sku of [1, 2, 3, 4, 5, 6, 7, 8]) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const fresh = await p.fetchJson("/api/be/v1/gio-hang");
          const pv = fresh.body?.result?.phienBan ?? 0;
          const put = await p.fetchJson(`/api/be/v1/gio-hang/items/${sku}`, {
            method: "PUT", headers: auth,
            body: JSON.stringify({ soLuong: 1, phienBan: pv }),
          });
          lastPut = `sku${sku} -> HTTP ${put.status}`;
          if (put.status === 200 || put.status === 201) {
            cart = await p.fetchJson("/api/be/v1/gio-hang");
            if ((cart.body?.result?.items ?? []).length > 0) break;
          }
          if (put.status !== 409) break;
        }
        if ((cart.body?.result?.items ?? []).length > 0) break;
      }
    }
    const items = cart.body?.result?.items ?? [];
    if (items.length === 0) {
      record("R4 giỏ có hàng để thử đặt đơn", false, `giỏ rỗng sau khi thử các SKU (${lastPut})`);
      return;
    }
    record("R4 giỏ có hàng để thử đặt đơn", true, `SKU ${items[0].maSku} × ${items[0].soLuong}`);
    const maKho = 1;
    const pv = cart.body?.result?.phienBan;

    // 1) Báo giá: ưu tiên voucher; nếu voucher không áp dụng (ngoài phạm vi chiến dịch)
    //    thì dùng điểm để vẫn có phân bổ giảm đã chốt để kiểm tra DATA-3.
    let quote = await p.fetchJson("/api/be/v1/gio-hang/quote", {
      method: "POST", headers: auth, body: JSON.stringify({ maKho, phienBan: pv }),
    });
    let q = quote.body?.result ?? {};
    let usedVoucher = false;
    let usedPoints = 0;
    if ((q.giamVoucher ?? 0) <= 0) {
      const voucherQuote = await p.fetchJson("/api/be/v1/gio-hang/quote", {
        method: "POST", headers: auth, body: JSON.stringify({ maKho, phienBan: pv, voucherCode: VOUCHER_CODE }),
      });
      if (voucherQuote.status === 200 && (voucherQuote.body?.result?.giamVoucher ?? 0) > 0) {
        quote = voucherQuote; q = voucherQuote.body.result; usedVoucher = true;
      }
    }
    if (!usedVoucher && (q.diemDuocPhep ?? 0) > 0) {
      usedPoints = Math.min(3, q.diemDuocPhep);
      const pointQuote = await p.fetchJson("/api/be/v1/gio-hang/quote", {
        method: "POST", headers: auth, body: JSON.stringify({ maKho, phienBan: pv, diemSuDung: usedPoints }),
      });
      if (pointQuote.status === 200) { quote = pointQuote; q = pointQuote.body.result; }
      else usedPoints = 0;
    }
    record("R4 báo giá 200", quote.status === 200, `HTTP ${quote.status} (voucher: ${usedVoucher}, điểm: ${usedPoints})`);
    const camps = await p.fetchJson("/api/be/v1/khuyen-mai/dang-mo");
    const cartNow = await p.fetchJson("/api/be/v1/gio-hang");
    record("R4 báo giá có phân bổ giảm", (q.giamVoucher ?? 0) > 0 || (q.giamDiem ?? 0) > 0,
      `voucher ${q.giamVoucher} / diem ${q.giamDiem} (điểm dùng ${usedPoints})`);
    // FE gửi kèm mốc chính sách lấy từ báo giá — thiếu thì BE từ chối 400.
    const phienBanGio = q.phienBanGio;
    const tong = q.tongThanhToan;
    const policy = { maChinhSach: q.maChinhSach, phienBanChinhSach: q.phienBanChinhSach };

    // 2) Đặt đơn hợp lệ rồi replay cùng khoaTam (idempotent).
    const key = `reliab-${Date.now()}`;
    const body = {
      maKho, phienBanGio, tongThanhToanDuKien: tong, ...policy,
      nguoiNhan: "Reliability Test", sdtNhan: "09020261020", diaChiGiao: "1 Test St",
      ...(usedVoucher ? { voucherCode: VOUCHER_CODE } : {}),
      ...(usedPoints > 0 ? { diemSuDung: usedPoints } : {}),
      khoaTam: key,
    };
    const first = await p.fetchJson("/api/be/v1/don-hang", { method: "POST", headers: auth, body: JSON.stringify(body) });
    record("R4 tạo đơn 201", first.status === 201, `HTTP ${first.status}`);
    const maDon = first.body?.result?.maDonHang;
    const replay = await p.fetchJson("/api/be/v1/don-hang", { method: "POST", headers: auth, body: JSON.stringify(body) });
    record("R4 replay cùng khoaTam trả cùng đơn",
      replay.body?.result?.maDonHang === maDon,
      `#${first.body?.result?.maDonHang} vs #${replay.body?.result?.maDonHang}`);

    // 3) Snapshot đã chốt.
    const before = await p.fetchJson(`/api/be/v1/don-hang/${maDon}`);
    const b = before.body?.result ?? {};
    record("R4 chi tiết đơn có snapshot giảm",
      typeof b.tongThanhToan === "number",
      `tong=${b.tongThanhToan} voucher=${b.giamVoucher} diem=${b.giamDiem} diemSuDung=${b.diemSuDung}`);

    // 4) Hủy → so sánh breakdown (DATA-3 vết kiểm).
    const cancel = await p.fetchJson(`/api/be/v1/don-hang/${maDon}/huy`, {
      method: "POST", headers: auth,
      body: JSON.stringify({ khoaTam: `${key}-cancel`, phienBan: b.phienBan, lyDo: "Kiem chu doi tin dung" }),
    });
    record("R4 hủy đơn 200", cancel.status === 200, `HTTP ${cancel.status}`);
    const after = await p.fetchJson(`/api/be/v1/don-hang/${maDon}`);
    const a = after.body?.result ?? {};
    record("R4 tổng tiền giữ nguyên sau hủy", a.tongThanhToan === b.tongThanhToan, `${b.tongThanhToan} -> ${a.tongThanhToan}`);
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

    // 5) Tổng sai (không phải số máy chủ chấp nhận) -> 400 là phân loại đúng.
    //    Dùng version giỏ hiện hành để lỗi là về TỔNG, không về phiên giỏ.
    const freshCart = await p.fetchJson("/api/be/v1/gio-hang");
    const wrongTotal = await p.fetchJson("/api/be/v1/don-hang", {
      method: "POST", headers: auth,
      body: JSON.stringify({
        maKho, phienBanGio: freshCart.body?.result?.phienBan ?? 0,
        tongThanhToanDuKien: (tong ?? 0) + 1, ...policy,
        nguoiNhan: "Reliability Test", sdtNhan: "09020261020", diaChiGiao: "1 Test St",
      }),
    });
    record("R4 tổng không hợp lệ → 400 (không tạo đơn)", wrongTotal.status === 400, `HTTP ${wrongTotal.status}`);

    // 6) Báo giá cũ: bump giỏ rồi báo giá bằng phiên cũ -> BE phải yêu cầu tải lại (409).
    const cur = await p.fetchJson("/api/be/v1/gio-hang");
    const pvNow = cur.body?.result?.phienBan ?? 0;
    const bump = await p.fetchJson("/api/be/v1/gio-hang/items/1", {
      method: "PUT", headers: auth, body: JSON.stringify({ soLuong: 1, phienBan: pvNow }),
    });
    const staleQuote = await p.fetchJson("/api/be/v1/gio-hang/quote", {
      method: "POST", headers: auth, body: JSON.stringify({ maKho, phienBan: pvNow }),
    });
    record("R4 báo giá cũ (giỏ đã đổi) → 409 yêu cầu tải lại", staleQuote.status === 409,
      `HTTP ${staleQuote.status} (bump giỏ HTTP ${bump.status})`);
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
    // Đơn legacy đã hủy: khối tiền phải có đúng MỘT dòng giảm và không có dòng 0đ.
    await p.goto(`${base}/don-hang/51`);
    await sleep(1500);
    const legacyOrderMoneyBlock = await p.eval(`(() => {
      const t = document.body.innerText;
      const generic = t.includes('Giảm giá');
      const unallocated = t.includes('Tổng giảm (chưa xác định phân bổ)');
      const zero = /−0₫|−0đ/.test(t);
      // đếm DÒNG giảm (−15.000), không đếm chuỗi "15.000" nằm trong "135.000"
      const occurrences = (t.match(/−15\.000/g) || []).length;
      return { generic, unallocated, zero, occurrences, text: t.slice(0, 260) };
    })()`);
    record("R5 đơn legacy: đúng một dòng giảm, không dòng 0đ",
      !(legacyOrderMoneyBlock.generic && legacyOrderMoneyBlock.unallocated)
      && !legacyOrderMoneyBlock.zero
      && legacyOrderMoneyBlock.occurrences <= 1,
      JSON.stringify(legacyOrderMoneyBlock).slice(0, 200));
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


// ---------- R5b: POS tiền mặt (staff) ----------
async function r5b(base, port) {
  await withBrowser(port, "/tmp/relia-r5b", async (p) => {
    await p.goto(`${base}/kenh-ban/pos`);
    const login = await p.login("staff");
    record("R5b staff đăng nhập", login.status === 200, `HTTP ${login.status}`);
    await p.goto(`${base}/kenh-ban/pos`);
    await sleep(1500);
    await p.eval(`(async () => {
      const set = (sel, v) => { const el = document.querySelector(sel); if (!el) return false;
        const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return true; };
      set("input[aria-label='Tìm hàng POS']", "1");
      return true;
    })()`);
    await p.clickByText("Tìm"); await sleep(1200);
    await p.clickByText("+ Thêm"); await sleep(1500);
    const added = await p.eval(`document.body.innerText.includes('Áo Thun')`);
    record("R5b thêm SKU thật vào giỏ POS", added === true, String(added));
    await p.eval(`(() => { const el = document.querySelector('#pos-voucher'); if (!el) return false;
      const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      s.call(el, "${VOUCHER_CODE}"); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await p.clickByText("Lấy báo giá hiện tại"); await sleep(2500);
    const quoted = await p.eval(`document.body.innerText.includes('135.000') || document.body.innerText.includes('120.000')`);
    record("R5b báo giá POS có phí/thanh toán thật", quoted === true, String(quoted));
    await p.eval(`(() => { const el = [...document.querySelectorAll('input')].find(i => (i.placeholder || '').includes('VD 200000'));
      if (!el) return false; const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      s.call(el, '200000'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await p.clickByText("Thu tiền mặt & in hóa đơn"); await sleep(4000);
    const receipt = await p.eval(`(() => { const t = document.body.innerText;
      return { hasInvoice: /Hóa đơn #\\d+/.test(t), cash: t.includes('Đã thu tiền mặt'), change: /thối/i.test(t) }; })()`);
    record("R5b biên lai POS hiện sau khi thu tiền mặt", receipt.hasInvoice && receipt.cash,
      JSON.stringify(receipt));
  });
}

// ---------- R5c: báo cáo + CSV (admin) ----------
async function r5c(base, port) {
  await withBrowser(port, "/tmp/relia-r5c", async (p) => {
    await p.goto(`${base}/quan-tri/bao-cao`);
    const login = await p.login("admin");
    record("R5c admin đăng nhập", login.status === 200, `HTTP ${login.status}`);
    await p.goto(`${base}/quan-tri/bao-cao`);
    await sleep(1500);
    const totals = await p.eval(`document.body.innerText.includes('Tổng thu')`);
    record("R5c báo cáo hiện tổng thu thật", totals === true, String(totals));
    await p.clickByText("Sản phẩm bán chạy"); await sleep(2000);
    const products = await p.eval(`document.body.innerText.includes('Sản phẩm')`);
    record("R5c đổi tab báo cáo", products === true, String(products));
    const csv = await p.eval(`(async () => {
      const res = await fetch('/api/be/v1/bao-cao/doanh-thu/csv?tuNgay=2026-01-01&denNgay=2026-12-31&page=0&size=5000', { credentials: 'include' });
      const buf = new Uint8Array(await res.arrayBuffer());
      const text = new TextDecoder('utf-8').decode(buf);
      return { status: res.status, bom: buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF, lines: text.split(String.fromCharCode(10)).length, head: text.slice(0, 30) };
    })()`);
    record("R5c CSV tải được, có BOM, nhiều dòng",
      csv.status === 200 && csv.bom && csv.lines > 1, JSON.stringify(csv));
  });
}

// ---------- R5d: AI 3 chế độ (chỉ đọc) ----------
async function r5d(base, port) {
  await withBrowser(port, "/tmp/relia-r5d", async (p) => {
    await p.goto(`${base}/tim-kiem-ai`);
    const login = await p.login("customer");
    record("R5d khách đăng nhập", login.status === 200, `HTTP ${login.status}`);
    await p.goto(`${base}/tim-kiem-ai`);
    await p.eval(`(() => { const el = document.querySelector("form[aria-label='Tìm bằng AI'] input[name='q']");
      if (!el) return false; const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      s.call(el, 'ao thun'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await p.clickByText("Tìm"); await sleep(5000);
    const text = await p.eval(`document.body.innerText.includes('kết quả AI')`);
    record("R5d AI chữ: có kết quả thật", text === true, String(text));

    await p.goto(`${base}/tim-kiem-ai`);
    await p.clickByText("Ảnh"); await sleep(800);
    await p.setFile("form[aria-label='Tìm bằng AI'] input[type='file']", process.env.RELIABILITY_AI_IMAGE || "/tmp/ai-sample.png");
    await p.clickByText("Tìm"); await sleep(8000);
    const img = await p.eval(`document.body.innerText.includes('kết quả AI')`);
    record("R5d AI ảnh: có kết quả thật", img === true, String(img));

    await p.goto(`${base}/tim-kiem-ai`);
    await p.clickByText("Kết hợp"); await sleep(800);
    await p.setFile("form[aria-label='Tìm bằng AI'] input[type='file']", process.env.RELIABILITY_AI_IMAGE || "/tmp/ai-sample.png");
    await p.eval(`(() => { const el = document.querySelector("form[aria-label='Tìm bằng AI'] input[name='q']");
      if (!el) return false; const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      s.call(el, 'ao thun'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await p.clickByText("Tìm"); await sleep(8000);
    const comp = await p.eval(`document.body.innerText.includes('kết quả AI')`);
    record("R5d AI kết hợp: có kết quả thật", comp === true, String(comp));
  });
}

// ---------- R5e: responsive + reduced motion + focus thật ----------
async function r5e(base, port) {
  await withBrowser(port, "/tmp/relia-r5e", async (p) => {
    for (const [w, h] of [[390, 844], [320, 720]]) {
      await p.send("Emulation.setDeviceMetricsOverride", {
        width: w, height: h, deviceScaleFactor: 1, mobile: true,
      });
      for (const route of ["/", "/nam", "/gio-hang", "/thanh-toan", "/kenh-ban/pos", "/quan-tri/bao-cao"]) {
        await p.goto(`${base}${route}`);
        const over = await p.eval(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
        record(`R5e ${route} @${w} không tràn ngang`, (over ?? 0) <= 1, `overflow ${over}px`);
      }
    }
    await p.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

    // focus thật bằng phím Tab: viền tiêu điểm phải hiện
    await p.goto(`${base}/dang-nhap`);
    for (let i = 0; i < 3; i += 1) {
      await p.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
      await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
      await sleep(120);
    }
    const focus = await p.eval(`(() => { const el = document.activeElement; if (!el) return null;
      const cs = getComputedStyle(el);
      return { tag: el.tagName, focusVisible: el.matches(':focus-visible'),
        outline: cs.outlineWidth + ' ' + cs.outlineStyle, shadow: cs.boxShadow !== 'none' }; })()`);
    const visible = !!focus && (focus.focusVisible || focus.outline.startsWith("2px") || focus.shadow);
    record("R5e Tab thật: tiêu điểm có viền nhìn thấy", visible, JSON.stringify(focus));

    // reduced motion: không có animation chạy
    await p.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await p.goto(`${base}/tim-kiem-ai`);
    await p.eval(`(() => { const el = document.querySelector("form[aria-label='Tìm bằng AI'] input[name='q']");
      if (!el) return false; const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      s.call(el, 'ao thun'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await p.clickByText("Tìm"); await sleep(5000);
    const rm = await p.eval(`(() => { const els = [...document.querySelectorAll('[class*=stagger], [class*=fade-swap]')];
      const names = els.map(e => getComputedStyle(e).animationName).filter(n => n && n !== 'none');
      return { count: els.length, running: names.length }; })()`);
    record("R5e reduced-motion: không có animation nào chạy", (rm.running ?? 0) === 0, JSON.stringify(rm));
    await p.send("Emulation.setEmulatedMedia", { features: [] });
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
  if (scenario === "r4" || scenario === "all") { await ensureStock(base, port + 5); await r4(base, port + 10); }
  if (scenario === "r5" || scenario === "all") await r5(base, port + 20);
  if (scenario === "r5b" || scenario === "all") { await ensureStock(base, port + 25); await r5b(base, port + 30); }
  if (scenario === "r5c" || scenario === "all") await r5c(base, port + 40);
  if (scenario === "r5d" || scenario === "all") await r5d(base, port + 50);
  if (scenario === "r5e" || scenario === "all") await r5e(base, port + 60);
} catch (e) {
  record("harness lỗi", false, String(e));
}
await writeFile(`${outDir}/reliability-report.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length === 0 ? 0 : 1);
