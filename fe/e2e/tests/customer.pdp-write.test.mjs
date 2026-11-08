// [customer:write] PDP cart-full repro (guest-ineligible): product 3127 / size 41.
// Fills the server cart to the SKU stock, forces one more UI add past the
// quota, then expects the red alert with the full-cart copy, the buy button
// reading "Đã có đủ trong giỏ" and a locked stepper. Cleans the cart after.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cfg } from "../lib/config.mjs";
import { suite } from "../lib/suite.mjs";
import { launch, loginContext } from "../lib/browser.mjs";
import { step } from "../lib/steps.mjs";

suite("customer", "PDP cart-full alert", () => {
  let browser;
  before(async () => { browser = await launch(); });
  after(async () => { await browser?.close(); });

  test("PDP: size 41 fills the cart, then the red full-cart alert (write)", { timeout: 240000 }, async (t) => {
    const probe = await browser.newContext();
    const pj = await (await probe.request.get(`${cfg.baseUrl}/api/catalog/products/3127`)).json();
    await probe.close();
    const variants = pj?.result?.variants ?? [];
    const target = variants.find((v) => v.size === "41");
    if (!target?.skuId || !(target.availableStock > 0)) return t.skip("product 3127 / size 41 has no sellable stock on this build");
    const skuId = target.skuId;
    const stock = target.availableStock;

    let ctx;
    try {
      ctx = await loginContext(browser, "CUSTOMER");
    } catch (e) {
      return t.skip(`no CUSTOMER fixture: ${e.message}`);
    }
    const { c, req } = ctx;
    const page = await c.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e?.message ?? e)));
    try {
      await step(t, "start from an empty cart", async () => {
        await req("/api/customer-commerce/cart", "DELETE", {});
      });
      await page.goto(`${cfg.baseUrl}/san-pham/3127`);
      await page.waitForSelector("h1");
      await step(t, "select size 41", async () => {
        await page.waitForSelector(".cat-option-chip", { timeout: 8000 });
        await page.locator('.cat-option-chip[aria-label="41"]').click();
        await page.waitForSelector(".cat-button.cat-primary:not([disabled])", { timeout: 8000 });
      });
      const buy = () => page.locator(".cat-button.cat-primary");
      const uiAdds = Math.max(0, stock - 1);
      await step(t, `UI adds ${uiAdds} (cart now one short of full)`, async () => {
        for (let i = 0; i < uiAdds; i++) {
          await Promise.all([
            page.waitForResponse((r) => r.url().includes("/api/customer-commerce/cart/items") && r.request().method() === "POST", { timeout: 10000 }),
            buy().click(),
          ]);
        }
      });
      await step(t, "API tops the cart to full behind the UI state", async () => {
        const r = await req("/api/customer-commerce/cart/items", "POST", { skuId, quantity: 1 });
        assert.ok([200, 201].includes(r.http), `top-up HTTP ${r.http} ${r.message ?? ""}`);
      });
      await step(t, "one more UI add is rejected with the red full-cart alert", async () => {
        await Promise.all([
          page.waitForResponse((r) => r.url().includes("/api/customer-commerce/cart/items") && r.request().method() === "POST", { timeout: 10000 }),
          buy().click(),
        ]);
        await page.waitForSelector("#cat-stock-alert", { timeout: 10000 });
        const text = await page.locator("#cat-stock-alert").innerText();
        assert.match(text, new RegExp(`Size 41 chỉ còn ${stock} (đôi|sản phẩm) và giỏ của bạn đã có đủ ${stock} rồi`));
        // refresh() sau lỗi bất đồng bộ — chờ giỏ đồng bộ rồi mới khóa nút.
        await page.waitForFunction(() => document.querySelector(".cat-button.cat-primary")?.textContent?.includes("Đã có đủ"), null, { timeout: 10000 });
        assert.match(await buy().innerText(), /Đã có đủ trong giỏ/);
        assert.ok(await page.getByRole("button", { name: "Giảm số lượng" }).isDisabled(), "stepper − locked");
        assert.ok(await page.getByRole("button", { name: "Tăng số lượng" }).isDisabled(), "stepper + locked");
        assert.equal(await page.locator("#cat-stock-alert").getAttribute("role"), "alert");
        assert.equal(await buy().getAttribute("aria-describedby"), "cat-stock-alert");
      });
      await step(t, "no uncaught page errors", async () => { assert.deepEqual(errors, []); });
    } finally {
      await step(t, "clean the cart afterwards", async () => {
        await req("/api/customer-commerce/cart", "DELETE", {});
      });
      await c.close();
    }
  });
}, { write: true });
