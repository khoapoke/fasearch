// [admin] ADMIN route sweep (1440 + 390), layout/links scan, filter-reset behaviour, injected-503
// recovery states and product-form states. Read-only against the server (the 503 cases are browser-side
// request interception). Ported from admin-quality-pass-20261105/live/{audit/audit-admin,layout-links,
// reset-checks,state-checks,product-state-checks}.mjs.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cfg } from "../lib/config.mjs";
import { suite } from "../lib/suite.mjs";
import { launch, loginContext } from "../lib/browser.mjs";
import { step } from "../lib/steps.mjs";
import { loadState } from "../lib/state.mjs";

const SPECS = [["orders", "/api/admin/orders?page=0&size=10", "don-hang", "id"], ["customers", "/api/admin/customers?page=0&size=10", "khach-hang", "id"], ["employees", "/api/admin/employees?page=0&size=10", "nhan-vien", "id"], ["products", "/api/admin/catalog/products?page=0&size=10", "san-pham", "id"], ["stock", "/api/admin/stock?page=0&size=10", "ton-kho", "skuId"], ["imports", "/api/admin/imports?page=0&size=10", "phieu-nhap", "receiptId"], ["exports", "/api/admin/exports?page=0&size=10", "phieu-xuat", "receiptId"], ["stocktakes", "/api/admin/stocktakes?page=0&size=10", "kiem-ke", "stocktakeId"], ["drafts", "/api/admin/catalog/drafts?page=0&size=10", "san-pham/nhap", "id"]];
const STATIC = ["", "don-hang", "khach-hang", "khach-hang/moi", "nhan-vien", "nhan-vien/moi", "tai-khoan-noi-bo", "san-pham", "san-pham/new", "danh-muc", "ton-kho", "phieu-nhap", "phieu-nhap/moi", "phieu-xuat", "phieu-xuat/moi", "kiem-ke", "kiem-ke/moi", "khuyen-mai", "chinh-sach-diem", "bao-cao", "nhat-ky", "tai-khoan"];
const REDIRECTS = { "/quan-tri/tai-khoan": "/quan-tri/tai-khoan-noi-bo" };
// Accepted by the Admin quality pass (ADMIN-AUDIT.md): wide data tables at 390px.
const WIDE_TABLE_390 = new Set(["/quan-tri/khuyen-mai", "/quan-tri/bao-cao"]);

suite("admin", "ADMIN sweep, layout, states", () => {
  let browser, admin;
  before(async () => { browser = await launch(); admin = await loginContext(browser, "ADMIN"); });
  after(async () => { await admin?.c.close(); await browser?.close(); });

  async function api(path) { const r = await admin.req(path); let items = r.data?.content ?? r.data ?? []; if (!Array.isArray(items)) items = items.drafts ?? []; return { http: r.http, items }; }

  test("route sweep: status, final path, console/page errors, failed responses, overflow, labels, clipping, tokens", { timeout: 900000 }, async (t) => {
    const routes = [...STATIC]; const idRoutes = new Set();
    for (const [, path, route, key] of SPECS) {
      const { items } = await api(path); const it = items[0]; const id = it?.[key] ?? it?.draftId ?? it?.orderId;
      if (id) { routes.push(`${route}/${id}`); if (route === "san-pham") routes.push(`${route}/${id}/sua`, `${route}/${id}/xem-truoc`); }
    }
    const st = loadState(); for (const r of st.adminRoutes ?? []) if (!routes.includes(r)) routes.push(r); // ids created by the write suite (if it ran earlier)
    const linkSet = new Set();
    for (const width of [1440, 390]) {
      const p = await admin.c.newPage(); await p.setViewportSize({ width, height: width === 390 ? 844 : 900 }); p.setDefaultTimeout(12000);
      let errors = [], failed = [];
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      p.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
      for (const route of routes) {
        errors = []; failed = [];
        const url = "/quan-tri" + (route ? "/" + route : "");
        const todo = width === 390 && WIDE_TABLE_390.has(url) ? "accepted wide table at 390px (ADMIN-AUDIT.md)" : undefined;
        await step(t, `${url} @${width}`, async () => {
          const res = await p.goto(cfg.baseUrl + url, { waitUntil: "networkidle", timeout: 30000 });
          await p.waitForTimeout(350);
          const dom = await p.evaluate(() => {
            const main = document.querySelector("main") || document.body;
            const overflow = [...main.querySelectorAll("*")].filter((e) => { const b = e.getBoundingClientRect(), s = getComputedStyle(e); return b.width > 0 && (b.right > innerWidth + 2 || b.left < -2) && s.position !== "fixed" && !e.closest(".table-scroll,.catalog-table-scroll,.review-table-scroll"); }).slice(0, 5).map((e) => `${e.tagName}.${String(e.className).slice(0, 30)}`);
            const unlabeled = [...main.querySelectorAll("button,input,select,textarea")].filter((e) => !(e.tagName === "INPUT" && e.type === "hidden") && !e.getAttribute("aria-label") && !e.getAttribute("aria-labelledby") && !e.labels?.length && !e.textContent?.trim() && !e.getAttribute("title")).map((e) => e.outerHTML.slice(0, 80));
            const clip = [...main.querySelectorAll("*")].filter((e) => { const s = getComputedStyle(e), b = e.getBoundingClientRect(); return e.children.length === 0 && e.textContent.trim() && b.width > 0 && (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2) && ["hidden", "clip"].includes(s.overflow) && s.textOverflow !== "ellipsis" && !e.closest(".table-scroll"); }).slice(0, 5).map((e) => e.textContent.slice(0, 60));
            const occluded = [...document.querySelectorAll("main button,main a,main input,main select")].filter((e) => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.top < 70 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) return false; const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit && !e.contains(hit) && !hit.contains(e); }).slice(0, 5).map((e) => (e.textContent || e.getAttribute("aria-label") || e.id).trim().slice(0, 60));
            return { overflow, unlabeled, clip, occluded, tokens: /\b(?:undefined|NaN|Invalid Date)\b/.test(main.innerText), h1: main.querySelector("h1")?.textContent ?? "", links: [...main.querySelectorAll("a[href]")].map((e) => e.getAttribute("href")) };
          });
          for (const h of dom.links) if (h.startsWith("/quan-tri")) linkSet.add(h);
          const want = REDIRECTS[url] ?? url;
          const final = new URL(p.url()).pathname;
          const problems = [];
          if (res.status() !== 200) problems.push(`http ${res.status()}`);
          if (final !== want) problems.push(`final path ${final} (want ${want})`);
          if (errors.length) problems.push("console/page errors: " + [...new Set(errors)].slice(0, 3).join(" | ").slice(0, 300));
          if (failed.length) problems.push("failed responses: " + [...new Set(failed)].slice(0, 4).join(", "));
          if (dom.overflow.length) problems.push("horizontal overflow: " + dom.overflow.join(", "));
          if (dom.unlabeled.length) problems.push("unlabeled controls: " + dom.unlabeled.join(" ; "));
          if (dom.clip.length) problems.push("clipped text: " + dom.clip.join(" | "));
          if (dom.occluded.length) problems.push("occluded controls: " + dom.occluded.join(" | "));
          if (dom.tokens) problems.push("unresolved undefined/NaN/Invalid Date text");
          assert.equal(problems.length, 0, problems.join("; "));
        }, { todo });
      }
      await p.close();
    }
    for (const h of linkSet) {
      const r = await admin.c.request.head(cfg.baseUrl + h);
      await step(t, `link ${h} resolves`, () => assert.ok(r.status() < 400, `http ${r.status()}`));
    }
  });

  test("filter reset buttons clear the query", { timeout: 300000 }, async (t) => {
    const p = await admin.c.newPage(); p.setDefaultTimeout(6000);
    for (const [route, input, button, endpoint] of [["don-hang", "#order-code", "Lọc", "orders"], ["khach-hang", "#cust-search", "Tìm", "customers"], ["nhan-vien", "#emp-search", "Tìm", "employees"], ["tai-khoan-noi-bo", "#ia-search", "Tìm", "accounts"], ["san-pham", "#catalog-keyword", "Lọc", "catalog/products"], ["ton-kho", "#st-keyword", "Lọc", "stock"], ["phieu-nhap", "#im-code", "Lọc", "imports"], ["phieu-xuat", "#ex-code", "Lọc", "exports"], ["kiem-ke", "#stk-code", "Lọc", "stocktakes"]]) {
      await step(t, `reset clears filter on ${route}`, async () => {
        await p.goto(cfg.baseUrl + "/quan-tri/" + route, { waitUntil: "networkidle" });
        let sel = p.locator(input); if (!(await sel.count())) sel = p.locator("main form input:not([type=hidden])").first();
        await sel.fill("NO_MATCH_E2E_SUITE");
        await p.locator("main form").first().getByRole("button", { name: button, exact: true }).click();
        await p.waitForTimeout(700);
        const wait = p.waitForRequest((r) => new URL(r.url()).pathname === "/api/admin/" + endpoint);
        await p.getByRole("button", { name: "Đặt lại", exact: true }).click();
        const r = await wait; await p.waitForTimeout(500);
        assert.ok(!new URL(r.url()).search.includes("NO_MATCH"), "query still carries the filter after reset: " + new URL(r.url()).search);
      });
    }
    await p.close();
  });

  test("injected 503 on each admin API shows an error with working retry; auth outage is not 'no permission'", { timeout: 600000 }, async (t) => {
    const p = await admin.c.newPage(); p.setDefaultTimeout(5000);
    for (const [route, endpoint] of [["", "/api/admin/overview"], ["don-hang", "/api/admin/orders"], ["khach-hang", "/api/admin/customers"], ["nhan-vien", "/api/admin/employees"], ["tai-khoan-noi-bo", "/api/admin/accounts"], ["san-pham", "/api/admin/catalog/products"], ["danh-muc", "/api/admin/catalog/categories"], ["ton-kho", "/api/admin/stock"], ["phieu-nhap", "/api/admin/imports"], ["phieu-xuat", "/api/admin/exports"], ["kiem-ke", "/api/admin/stocktakes"], ["khuyen-mai", "/api/admin/promotions"], ["chinh-sach-diem", "/api/admin/loyalty/policies"], ["bao-cao", "/api/admin/reports/revenue"]]) {
      await step(t, `503 on ${endpoint}: error + retry + recovery`, async () => {
        const pattern = (u) => u.pathname === endpoint;
        await p.route(pattern, (r) => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, message: "Dịch vụ tạm thời không sẵn sàng (E2E injected 503)" }) }));
        try {
          await p.goto(cfg.baseUrl + "/quan-tri" + (route ? "/" + route : ""), { waitUntil: "networkidle" });
          const alerts = await p.locator("[role=alert]").allTextContents(); const body = await p.locator("main").innerText();
          const retry = p.getByRole("button", { name: /Thử lại|Tải lại/ }); const n = await retry.count();
          assert.ok(body.includes("E2E injected 503") || alerts.length > 0, "no visible error");
          assert.ok(n > 0, "no retry control");
          await p.unroute(pattern);
          await retry.first().click(); await p.waitForTimeout(1300);
          assert.ok(!(await p.locator("main").innerText()).includes("E2E injected 503"), "error still shown after retry");
        } finally { await p.unroute(pattern).catch(() => {}); }
      });
    }
    await step(t, "auth outage (503 on /me) offers retry and is not shown as 'Không có quyền truy cập'", async () => {
      await p.route((u) => u.pathname === "/api/customer-auth/me", (r) => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, message: "E2E auth outage" }) }));
      try {
        await p.goto(cfg.baseUrl + "/quan-tri", { waitUntil: "networkidle" });
        const text = await p.locator("body").innerText(); const retry = p.getByRole("button", { name: /Thử lại/ });
        assert.ok(!text.includes("Không có quyền truy cập"), "outage misclassified as denied");
        assert.ok((await retry.count()) > 0, "no retry control");
        await p.unrouteAll({ behavior: "wait" });
        await retry.first().click(); await p.waitForTimeout(1500);
        assert.equal(await p.locator(".admB .shell").count(), 1, "shell did not recover");
      } finally { await p.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {}); }
    });
    await p.close();
  });

  test("product form: category outage/empty states finish loading", { timeout: 300000 }, async (t) => {
    const p = await admin.c.newPage(); await p.setViewportSize({ width: 390, height: 844 }); p.setDefaultTimeout(6000);
    for (const [route, status] of [["new", 503], ["new", 200], ["__FIRST__/sua", 200]]) {
      await step(t, `product-state ${route} categories=${status}`, async () => {
        let r = route;
        if (r.startsWith("__FIRST__")) { const { items } = await api("/api/admin/catalog/products?page=0&size=1"); r = String(items[0].id) + r.slice("__FIRST__".length); }
        const pattern = (u) => u.pathname === "/api/admin/catalog/categories";
        await p.route(pattern, (x) => x.fulfill({ status, contentType: "application/json", body: JSON.stringify(status === 200 ? { success: true, result: [] } : { success: false, message: "E2E injected category outage" }) }));
        try {
          await p.goto(cfg.baseUrl + "/quan-tri/san-pham/" + r, { waitUntil: "networkidle" });
          const text = await p.locator("main").innerText(); const recovery = await p.getByRole("button", { name: /Thử lại/ }).count(); const link = await p.locator('main a[href="/quan-tri/danh-muc"]').count();
          assert.ok(!text.includes("Đang tải"), "stuck loading"); assert.ok(status === 503 ? recovery > 0 : link > 0, status === 503 ? "no retry" : "no link to category management");
        } finally { await p.unroute(pattern).catch(() => {}); }
      });
    }
    await p.close();
  });
});
