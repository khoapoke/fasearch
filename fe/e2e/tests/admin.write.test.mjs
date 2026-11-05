// [admin:write] ADMIN write flows through the real UI on a CLONE database only.
// Ported from admin-quality-pass-20261105/live/{audit/write-flows,finish-flows,pointer-write-flows}.mjs.
// Covers: customer + HR profile create/edit, internal account create, category CRUD, product draft
// (create + edit of a published product's draft, never published), multi-line import/export,
// stocktake, promotion create/pause, loyalty edit+restore, order advance/cancel/cash collection,
// and real-pointer/keyboard receipt input. Everything created here is prefixed "E2E <stamp>".
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cfg } from "../lib/config.mjs";
import { suite } from "../lib/suite.mjs";
import { launch, loginContext } from "../lib/browser.mjs";
import { Client } from "../lib/http.mjs";
import { requireCreds } from "../lib/fixtures.mjs";
import { discoverSkus, discoverProduct, discoverUiSkus } from "../lib/data.mjs";
import { checkout } from "../lib/commerce.mjs";
import { step, res } from "../lib/steps.mjs";
import { saveState } from "../lib/state.mjs";

suite("admin", "ADMIN write flows (clone DB)", () => {
  let browser, admin, p, skus, orderSku, pid;
  const ids = {}; const stamp = Date.now().toString().slice(-7); const label = "E2E " + stamp;
  before(async () => {
    browser = await launch(); admin = await loginContext(browser, "ADMIN");
    p = await admin.c.newPage(); p.setDefaultTimeout(10000); p.on("dialog", (d) => d.accept());
    const g = new Client(); pid = await discoverProduct(g);
    const a = new Client(); const f = requireCreds("ADMIN"); await a.login(f.username, f.password); skus = (await discoverUiSkus(a, 2)).map(String); orderSku = (await discoverSkus(a, 1))[0]; // skus: selectable in the receipt forms (first 50 rows); orderSku: has stock for the order flow
  });
  after(async () => { saveState({ adminRoutes: Object.entries({ "san-pham/nhap": ids.draft, "kiem-ke": ids.stocktake, "phieu-nhap": ids.import, "phieu-xuat": ids.export, "khach-hang": ids.customer, "nhan-vien": ids.employee }).filter(([, v]) => v).map(([k, v]) => `${k}/${v}`) }); await admin?.c.close(); await browser?.close(); });

  const go = (route) => p.goto(cfg.baseUrl + route, { waitUntil: "networkidle" });
  async function writeClick(button, url, method = null) {
    const [rr] = await Promise.all([p.waitForResponse((r) => r.url().includes(url) && r.request().method() !== "GET" && (!method || r.request().method() === method)), button.click()]);
    let j; try { j = await rr.json(); } catch { /* none */ }
    if (rr.status() >= 400) throw new Error(`WRITE_HTTP_${rr.status()} ${j?.message ?? ""}`);
    await p.waitForTimeout(400); return j?.result;
  }
  async function typeInto(sel, text) { const e = p.locator(sel); await e.click(); await p.keyboard.press("ControlOrMeta+A"); await p.keyboard.type(text); assert.equal(await e.inputValue(), text, "input did not receive keyboard text " + sel); }

  test("people, accounts, categories, products", { timeout: 600000 }, async (t) => {
    await step(t, "customer create", async () => { await go("/quan-tri/khach-hang/moi"); await p.fill("#cust-first", "Kiểm thử"); await p.fill("#cust-last", label); await p.fill("#cust-phone", "09" + stamp.padStart(8, "0")); const x = await writeClick(p.getByRole("button", { name: "Tạo khách hàng", exact: true }), "/api/admin/customers"); ids.customer = x.id; await p.waitForURL("**/khach-hang/" + x.id); });
    await step(t, "customer edit persists", async () => { await go("/quan-tri/khach-hang/" + ids.customer); await p.fill("#cust-address", "E2E clone — địa chỉ kiểm thử"); await writeClick(p.getByRole("button", { name: "Lưu thay đổi", exact: true }), "/api/admin/customers/"); const x = await admin.req("/api/admin/customers/" + ids.customer); assert.ok(x.data.address.includes("E2E"), "not persisted"); });
    await step(t, "employee create", async () => { await go("/quan-tri/nhan-vien/moi"); await p.fill("#emp-first", "Kiểm thử"); await p.fill("#emp-last", label); await p.fill("#emp-phone", "08" + stamp.padStart(8, "0")); await p.fill("#emp-cccd", "07900" + stamp); const x = await writeClick(p.getByRole("button", { name: "Tạo hồ sơ nhân sự", exact: true }), "/api/admin/employees"); ids.employee = x.id; await p.waitForURL("**/nhan-vien/" + x.id); });
    await step(t, "employee edit persists", async () => { await go("/quan-tri/nhan-vien/" + ids.employee); await p.getByRole("button", { name: "Sửa hồ sơ", exact: true }).click(); await p.fill("#emp-address", "E2E clone"); await writeClick(p.getByRole("button", { name: "Lưu hồ sơ", exact: true }), "/api/admin/employees/"); const x = await admin.req("/api/admin/employees/" + ids.employee); assert.ok(x.data.address.includes("E2E"), "not persisted"); });
    await step(t, "internal (STAFF) account create via UI (credentials stay in memory)", async () => { await go("/quan-tri/tai-khoan-noi-bo"); await p.getByRole("button", { name: "Tạo tài khoản", exact: true }).click(); await p.fill("#acct-username", "e2e_staff_" + stamp); await p.fill("#acct-email", `e2e_${stamp}@example.invalid`); await p.fill("#acct-password", randomUUID() + "Aa1!"); const x = await writeClick(p.locator("form.catalog-form").getByRole("button", { name: "Tạo tài khoản", exact: true }), "/api/admin/accounts"); assert.ok(x.id); });
    await step(t, "category create", async () => { await go("/quan-tri/danh-muc"); await p.fill("#category-name", label); const x = await writeClick(p.getByRole("button", { name: "Tạo danh mục", exact: true }), "/api/admin/catalog/categories"); ids.category = x.id; });
    await step(t, "category edit", async () => { await go("/quan-tri/danh-muc"); const row = p.locator("tr").filter({ has: p.locator("td:first-child").getByText(String(ids.category), { exact: true }) }); await row.getByRole("button", { name: "Sửa", exact: true }).click(); await row.getByRole("textbox", { name: "Tên danh mục", exact: true }).fill(label + " sửa"); await writeClick(row.getByRole("button", { name: "Lưu", exact: true }), "/api/admin/catalog/categories/"); });
    await step(t, "category delete", async () => { await go("/quan-tri/danh-muc"); const row = p.locator("tr").filter({ hasText: label + " sửa" }); await writeClick(row.getByRole("button", { name: "Xóa", exact: true }), "/api/admin/catalog/categories/"); assert.equal(await p.locator("tr").filter({ hasText: label + " sửa" }).count(), 0, "deleted row remains"); });
    await step(t, "product: new draft saved (not published)", async () => { await go("/quan-tri/san-pham/new"); await p.fill("#pf-name", label + " draft"); const val = await p.locator("#pf-category option").nth(1).getAttribute("value"); await p.selectOption("#pf-category", val); await p.fill("#pf-price", "250000"); await p.fill("#pf-description", "Bản nháp e2e trên clone, không xuất bản AI"); const x = await writeClick(p.getByRole("button", { name: "Lưu bản nháp", exact: true }), "/api/admin/catalog/drafts"); ids.draft = x.draftId; assert.ok(x.draftId); await p.waitForURL("**/san-pham/nhap/" + x.draftId); });
    await step(t, "product: edit of a published product is saved to a draft only", async () => {
      const before = (await admin.req(`/api/admin/catalog/products/${pid}`)).data;
      await go(`/quan-tri/san-pham/${pid}/sua`); await p.fill("#pf-description", "E2E draft edit " + stamp);
      const x = await writeClick(p.getByRole("button", { name: "Lưu thay đổi vào bản nháp", exact: true }), "/api/admin/catalog/drafts"); ids.draft2 = x?.draftId;
      const after_ = (await admin.req(`/api/admin/catalog/products/${pid}`)).data; assert.equal(after_.description ?? null, before.description ?? null, "published product changed");
    });
    await step(t, "product: discard e2e drafts", async () => { for (const d of [ids.draft, ids.draft2].filter(Boolean)) { const r = await admin.req(`/api/admin/catalog/drafts/${d}`, "DELETE"); assert.ok([200, 204].includes(r.http), `discard http ${r.http}`); } });
  });

  test("inventory: import, export, stocktake", { timeout: 300000 }, async (t) => {
    await step(t, "multi-line import adds stock", async () => { await go("/quan-tri/phieu-nhap/moi"); await p.fill("#imp-supplier", label); await p.selectOption("#imp-sku-1", skus[0]); await p.fill("#imp-qty-1", "3"); await p.fill("#imp-price-1", "120000"); await p.getByRole("button", { name: "+ Thêm dòng", exact: true }).click(); await p.selectOption("#imp-sku-2", skus[1]); await p.fill("#imp-qty-2", "2"); await p.fill("#imp-price-2", "130000"); const x = await writeClick(p.getByRole("button", { name: "Tạo phiếu và cộng kho", exact: true }), "/api/admin/imports"); ids.import = x.receiptId; await p.waitForURL("**/phieu-nhap/" + x.receiptId); assert.equal(x.items.length, 2, "not multiline"); });
    await step(t, "export subtracts stock", async () => { await go("/quan-tri/phieu-xuat/moi"); await p.selectOption("#exp-sku-1", skus[0]); await p.fill("#exp-qty-1", "1"); await p.fill("#exp-reason-1", label); const x = await writeClick(p.getByRole("button", { name: "Tạo phiếu và trừ kho", exact: true }), "/api/admin/exports"); ids.export = x.receiptId; await p.waitForURL("**/phieu-xuat/" + x.receiptId); });
    await step(t, "stocktake recorded", async () => { await go("/quan-tri/kiem-ke/moi"); await p.fill("#st-note", label); await p.selectOption("#st-sku-1", skus[0]); await p.fill("#st-actual-1", "5"); const x = await writeClick(p.getByRole("button", { name: /Ghi nhận|Tạo phiếu/ }).last(), "/api/admin/stocktakes"); ids.stocktake = x.stocktakeId; await p.waitForURL("**/kiem-ke/" + x.stocktakeId); });
    await step(t, "receipt controls take real pointer + keyboard input (import 2 lines: totals 5 / 560000)", async () => {
      await go("/quan-tri/phieu-nhap/moi"); await p.fill("#imp-supplier", label + " pointer"); await p.selectOption("#imp-sku-1", skus[0]); await typeInto("#imp-qty-1", "2"); await typeInto("#imp-price-1", "100000"); await p.getByRole("button", { name: "+ Thêm dòng", exact: true }).click(); await p.selectOption("#imp-sku-2", skus[1]); await typeInto("#imp-qty-2", "3"); await typeInto("#imp-price-2", "120000");
      const x = await writeClick(p.getByRole("button", { name: "Tạo phiếu và cộng kho", exact: true }), "/api/admin/imports");
      assert.ok(x.items.length === 2 && x.totalQuantity === 5 && x.totalAmount === 560000, `values ${x.totalQuantity}/${x.totalAmount}`);
    });
    await step(t, "receipt controls take real pointer + keyboard input (export)", async () => { await go("/quan-tri/phieu-xuat/moi"); await p.selectOption("#exp-sku-1", skus[0]); await typeInto("#exp-qty-1", "1"); await typeInto("#exp-reason-1", label + " pointer"); const x = await writeClick(p.getByRole("button", { name: "Tạo phiếu và trừ kho", exact: true }), "/api/admin/exports"); assert.equal(x.totalQuantity, 1); });
  });

  test("promotions, loyalty, orders", { timeout: 600000 }, async (t) => {
    await step(t, "promotion create", async () => { await go("/quan-tri/khuyen-mai"); await p.getByRole("button", { name: "Tạo chương trình", exact: true }).click(); await p.getByLabel("Tên", { exact: true }).fill(label); await p.getByLabel("Giá trị", { exact: true }).fill("5"); const d0 = new Date().toISOString().slice(0, 10), d1 = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10); await p.getByLabel("Bắt đầu", { exact: true }).fill(`${d0}T00:00`); await p.getByLabel("Kết thúc", { exact: true }).fill(`${d1}T23:59`); const x = await writeClick(p.getByRole("button", { name: "Tạo", exact: true }), "/api/"); ids.promotion = x.maKm; assert.ok(x.maKm); });
    await step(t, "promotion pause", async () => { await go("/quan-tri/khuyen-mai"); const row = p.locator("tr").filter({ has: p.getByText("#" + ids.promotion, { exact: true }) }); await row.getByRole("button", { name: "Chi tiết", exact: true }).click(); await p.getByRole("button", { name: "Tải lại chi tiết", exact: true }).waitFor({ state: "visible" }); const reopen = p.getByRole("button", { name: "Mở lại (tiếp tục chạy)", exact: true }); if (await reopen.count()) await writeClick(reopen, "/api/admin/promotions"); const x = await writeClick(p.getByRole("button", { name: /Tạm dừng/ }).last(), "/api/admin/promotions"); assert.equal(x.trangThai, "TAM_DUNG"); });
    await step(t, "loyalty policy edit persists, then original value is restored", async () => {
      await go("/quan-tri/chinh-sach-diem"); const inp = p.getByLabel("Chi tiêu để tích 1 điểm (VNĐ)", { exact: true }); const orig = await inp.inputValue();
      await inp.fill(String(Number(orig) + 1)); await writeClick(p.getByRole("button", { name: "Lưu phiên bản mới", exact: true }), "/api/admin/loyalty");
      await go("/quan-tri/chinh-sach-diem"); const edited = await inp.inputValue();
      await inp.fill(orig); await writeClick(p.getByRole("button", { name: "Lưu phiên bản mới", exact: true }), "/api/admin/loyalty");
      await go("/quan-tri/chinh-sach-diem"); const restored = await inp.inputValue();
      assert.equal(edited, String(Number(orig) + 1), "edit not persisted"); assert.equal(restored, orig, "restore not persisted");
    });
    // Orders: create fresh PENDING orders as the fixture CUSTOMER (COD), then drive the admin UI.
    const cust = new Client(); const cf = requireCreds("CUSTOMER"); await cust.login(cf.username, cf.password);
    const mk = async (note) => { const { o } = await checkout(cust, Number(orderSku), 1, { note }); const id = res(o.j)?.orderId; assert.ok(id, "could not create fixture order: http " + o.code); return id; };
    const a = new Client(); const af = requireCreds("ADMIN"); await a.login(af.username, af.password);
    await step(t, "order advance PENDING -> CONFIRMED (UI)", async () => { const id = await mk("e2e advance"); await go("/quan-tri/don-hang/" + id); await p.getByRole("button", { name: "Xác nhận đơn", exact: true }).click(); const x = await writeClick(p.getByRole("button", { name: "Xác nhận đơn hàng", exact: true }), "/api/admin/orders/" + id + "/status"); assert.equal(x.status, "CONFIRMED"); });
    await step(t, "order cancel (UI, with reason)", async () => { const id = await mk("e2e cancel"); await go("/quan-tri/don-hang/" + id); await p.getByRole("button", { name: "Hủy đơn", exact: true }).click(); await p.fill("#admin-cancel-reason", label); const x = await writeClick(p.getByRole("button", { name: "Xác nhận hủy", exact: true }), "/api/admin/orders/" + id + "/cancel"); assert.equal(x.status, "CANCELLED"); });
    await step(t, "order cash collection on SHIPPING order (UI)", async () => {
      const id = await mk("e2e cash"); for (const s of ["CONFIRMED", "PACKING", "SHIPPING"]) { const r = await a.req("PATCH", `/api/admin/orders/${id}/status`, { body: { status: s } }); assert.equal(r.code, 200, `-> ${s}: http ${r.code}`); }
      await go("/quan-tri/don-hang/" + id); await p.fill("#cash-note", label + " — synthetic cash collection, no provider");
      const x = await writeClick(p.getByRole("button", { name: "Xác nhận đã thu tiền mặt", exact: true }), "/cash-collection"); assert.ok(x);
    });
  });
}, { write: true });
