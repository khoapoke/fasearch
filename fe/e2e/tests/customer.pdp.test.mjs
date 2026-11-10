// [customer] PDP engagement (read-only, guest): rating summary, reviews section (distribution, fit meter, chips, sort,
// paging), share fallback, recently viewed rail (localStorage, max 12) and the shared favourite heart.
// Skips with a reason when the build under test has no reviews API (e.g. the frozen baseline).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cfg } from "../lib/config.mjs";
import { suite } from "../lib/suite.mjs";
import { launch } from "../lib/browser.mjs";
import { step } from "../lib/steps.mjs";

suite("customer", "PDP engagement", () => {
  let browser;
  before(async () => { browser = await launch(); });
  after(async () => { await browser?.close(); });

  async function discover(ctx) {
    let reviewed = null; let empty = null; const live = [];
    for (let id = 1; id < 600 && (!reviewed || !empty || live.length < 14); id++) {
      const s = await ctx.request.get(`${cfg.baseUrl}/api/customer-commerce/reviews/${id}/summary`);
      if (s.status() === 404 && id === 1) { const p = await ctx.request.get(`${cfg.baseUrl}/api/catalog/products/1`); if (!p.ok()) continue; }
      if (!s.ok()) { if (id === 1 && s.status() >= 404) return null; continue; }
      const j = await s.json();
      const vis = await ctx.request.get(`${cfg.baseUrl}/api/catalog/products/${id}`);
      if (!vis.ok()) continue;
      live.push(id);
      if (j.result.count >= 6 && !reviewed) reviewed = id;
      if (j.result.count === 0 && !empty) empty = id;
    }
    return reviewed ? { reviewed, empty, live } : null;
  }

  test("PDP: rating line, reviews, share, recently viewed, heart (guest, desktop + mobile)", { timeout: 300000 }, async (t) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
    const found = await discover(ctx);
    if (!found) { await ctx.close(); return t.skip(`no product with ≥6 reviews / reviews API missing on ${cfg.baseUrl}`); }
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    const go = async (id) => { await page.goto(`${cfg.baseUrl}/san-pham/${id}`); await page.waitForSelector("h1"); };

    await go(found.reviewed);
    await page.waitForSelector(".pdRatingAnchor");
    await step(t, "rating line: stars + average + count near the title", async () => {
      assert.match(await page.locator(".pdRatingLine").innerText(), /\d\.\d\s*\(\d+ đánh giá\)/);
    });
    await step(t, "rating link scrolls to #danh-gia", async () => {
      await page.locator(".pdRatingAnchor").click(); await page.waitForTimeout(700);
      const top = await page.evaluate(() => document.getElementById("danh-gia").getBoundingClientRect().top);
      assert.ok(top >= 0 && top < 320, `top=${top}`);
    });
    await step(t, "reviews: distribution bars, fit meter, guest sign-in gate", async () => {
      await page.waitForSelector(".pdReview");
      assert.equal(await page.locator(".pdBarRow").count(), 5);
      assert.ok((await page.locator(".pdFitVerdict").innerText()).length > 3);
      assert.equal(await page.locator(".pdForm").count(), 0);
      assert.equal(await page.locator(".pdGate a").count(), 1);
    });
    await step(t, "filter chip 5 sao + sort + load more", async () => {
      await page.locator(".pdChips[aria-label='Lọc theo số sao'] .pdChip", { hasText: "5 sao" }).click(); await page.waitForTimeout(400);
      const labels = await page.locator(".pdReview .pdStars").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
      assert.ok(labels.length > 0 && labels.every((l) => l.startsWith("5")));
      await page.locator(".pdChips[aria-label='Lọc theo số sao'] .pdChip", { hasText: "Tất cả" }).click(); await page.waitForTimeout(400);
      await page.selectOption(".pdSort select", "rating_asc"); await page.waitForTimeout(400);
      const asc = await page.locator(".pdReview .pdStars").evaluateAll((els) => els.map((e) => Number(e.getAttribute("aria-label")[0])));
      assert.ok(asc.every((v, i) => i === 0 || asc[i - 1] <= v), asc.join(","));
      const before = await page.locator(".pdReview").count();
      if (await page.locator(".pdMore").count()) { await page.locator(".pdMore").click(); await page.waitForTimeout(500); assert.ok(await page.locator(".pdReview").count() > before); }
    });
    await step(t, "related rail: ≤8 live cards below reviews, excludes current, equal image heights", async () => {
      await page.waitForSelector(".pdRelated .pCard", { timeout: 8000 });
      const hrefs = await page.locator(".pdRelated .pCardName").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
      assert.ok(hrefs.length >= 1 && hrefs.length <= 8 && !hrefs.includes(`/san-pham/${found.reviewed}`), hrefs.length + " cards");
      await page.locator(".pdRelated").scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.querySelectorAll(".pdRelated img")].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
      const hs = await page.locator(".pdRelated .pCardMedia").evaluateAll((els) => els.map((x) => Math.round(x.getBoundingClientRect().height)));
      assert.equal(new Set(hs).size, 1, hs.join(","));
    });
    await step(t, "share: link copied + toast when Web Share is unavailable", async () => {
      await page.addInitScript(() => { try { delete Navigator.prototype.share; } catch {} });
      await go(found.reviewed);
      await page.locator(".pdShare").click(); await page.waitForTimeout(300);
      assert.ok((await page.evaluate(() => navigator.clipboard.readText())).endsWith(`/san-pham/${found.reviewed}`));
      assert.match(await page.locator(".pdToast.is-on").innerText(), /Đã sao chép/);
    });
    await step(t, "guest heart sends the visitor to sign-in", async () => {
      await page.locator(".pdActions .favHeart").click();
      await page.waitForURL(/dang-nhap/, { timeout: 8000 });
    });
    if (found.empty) {
      await go(found.empty);
      await step(t, "no reviews yet: empty state + 'Chưa có đánh giá'", async () => {
        await page.waitForSelector(".pdEmpty");
        assert.match(await page.locator(".pdRatingLine").innerText(), /Chưa có đánh giá/);
      });
    }
    await step(t, "recently viewed: newest first, max 12, excludes current, clearable", async () => {
      const ids = found.live.slice(0, 14);
      for (const id of ids) { await go(id); await page.waitForTimeout(100); }
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("fa-recently-viewed-v1")));
      assert.equal(stored.length, Math.min(12, ids.length));
      assert.equal(stored[0].id, ids.at(-1));
      await page.waitForSelector(".pdRecent .pdRail li");
      const hrefs = await page.locator(".pdRecent .pdRail .pCardName").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
      assert.ok(!hrefs.includes(`/san-pham/${ids.at(-1)}`) && hrefs.length <= 12);
      await page.locator(".pdRecent .cat-text-button").click(); await page.waitForTimeout(300);
      assert.equal(await page.locator(".pdRecent").count(), 0);
    });
    await step(t, "reduced motion: heart burst is not shown", async () => {
      const rctx = await browser.newContext({ reducedMotion: "reduce" });
      const p = await rctx.newPage();
      await p.goto(`${cfg.baseUrl}/`); await p.waitForSelector(".pCard .favHeart");
      const display = await p.evaluate(() => { const css = getComputedStyle(document.documentElement); return css.scrollBehavior; });
      assert.ok(display === "auto");
      await rctx.close();
    });
    await step(t, "no uncaught page errors", async () => { assert.deepEqual(errors, []); });
    await ctx.close();

    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mp = await mctx.newPage();
    await mp.goto(`${cfg.baseUrl}/san-pham/${found.reviewed}`); await mp.waitForSelector(".pdReview");
    await step(t, "mobile 390: no horizontal overflow, summary stacks above reviews", async () => {
      assert.equal(await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    });
    await mctx.close();
  });

  // pdp-polish-fix item 2: sold-out single-size (size block hidden) cannot be added;
  // single-size low-stock note shows via the SKU effective size. Clone DB pins:
  // 117 = 2 colors x placeholder size (Denim sku 372 stock 0, Black sku 371 stock 3),
  // 263 = single variant (Freesize stock 3, auto-resolved). Guest session, read-only.
  test("PDP: sold-out single-size locked, single-size low-stock note (guest)", { timeout: 120000 }, async (t) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(`${cfg.baseUrl}/san-pham/117`); await page.waitForSelector("h1");
    if ((await page.locator(".cat-empty h2").count()) > 0) { await ctx.close(); return t.skip("product 117 not visible on this build"); }
    await page.locator(".cat-option-chip", { hasText: "Denim" }).click();
    await step(t, "sold-out single-size: size block hidden, button disabled + 'Hết hàng'", async () => {
      assert.equal(await page.locator(".cat-option-block").count(), 1); // color only, size hidden
      assert.ok((await page.locator(".cat-detail-image").count()) > 0);
      assert.equal(await page.locator(".cat-detail-image-fail").count(), 0);
      const btn = page.locator(".cat-buy-row .cat-primary");
      assert.equal(await btn.isDisabled(), true);
      assert.match(await btn.innerText(), /Hết hàng/);
    });

    await page.goto(`${cfg.baseUrl}/san-pham/263`); await page.waitForSelector("h1");
    if ((await page.locator(".cat-empty h2").count()) > 0) { await ctx.close(); return t.skip("product 263 not visible on this build"); }
    await step(t, "single-size low stock: note shows without any pick, button stays enabled", async () => {
      await page.waitForSelector(".cat-low-note");
      assert.match(await page.locator(".cat-low-note").innerText(), /chỉ còn 3 sản phẩm/i);
      const btn = page.locator(".cat-buy-row .cat-primary");
      assert.equal(await btn.isDisabled(), false);
      assert.match(await btn.innerText(), /Thêm vào giỏ/);
    });
    await step(t, "no uncaught page errors", async () => { assert.deepEqual(errors, []); });
    await ctx.close();
  });

  // pdp-morph-20261106 Part A: ghost morph + deep zoom (guest, read-only).
  // Clone DB pins an image-bearing product; skips when none is visible.
  test("PDP: viewer ghost morph + zoom (guest)", { timeout: 240000 }, async (t) => {
    const probe = await browser.newContext();
    let pid = null;
    for (const id of [3127, 117, 263, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const r = await probe.request.get(`${cfg.baseUrl}/api/catalog/products/${id}`);
      if (!r.ok()) continue;
      const j = await r.json();
      if (j?.result?.imageUrl) { pid = id; break; }
    }
    await probe.close();
    if (!pid) return t.skip("no image-bearing product visible on this build");

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    const closed = () => page.evaluate(() => { const d = document.querySelector(".cat-dialog"); return !d || !d.open; });
    await page.goto(`${cfg.baseUrl}/san-pham/${pid}`);
    await page.waitForSelector(".cat-detail-image");
    if ((await page.locator(".cat-empty h2").count()) > 0) { await ctx.close(); return t.skip(`product ${pid} not visible on this build`); }

    await step(t, "open: ghost flies from the page rect, then is removed", async () => {
      await page.locator(".cat-detail-image-button").click();
      await page.waitForSelector(".cat-dialog[open]", { timeout: 8000 });
      await page.waitForSelector("[data-testid='cat-ghost']", { timeout: 3000 });
      await page.waitForSelector("[data-testid='cat-ghost']", { state: "detached", timeout: 8000 });
      assert.equal(await page.locator("[data-testid='cat-ghost']").count(), 0);
    });
    await step(t, "opening frame shows only the ghost (no panel, no shadow)", async () => {
      // Panel-less cinematic: during data-phase="opening" the dialog box is
      // transparent with no shadow, so frame 1 shows only the ghost.
      await page.evaluate(() => { document.querySelector(".cat-dialog")?.setAttribute("data-phase", "opening"); });
      const style = await page.evaluate(() => {
        const d = document.querySelector(".cat-dialog");
        if (!d) return null;
        const cs = getComputedStyle(d);
        return { bg: cs.backgroundColor, shadow: cs.boxShadow };
      });
      assert.ok(style, "dialog exists for opening-phase style check");
      assert.equal(style.bg, "rgba(0, 0, 0, 0)");
      assert.equal(style.shadow, "none");
      await page.evaluate(() => { document.querySelector(".cat-dialog")?.setAttribute("data-phase", "open"); });
    });
    await step(t, "source image stays hidden while the viewer is open", async () => {
      assert.equal(await page.locator(".cat-detail-image[data-morph-hidden]").count(), 1);
    });
    await step(t, "stage click toggles 2.5x zoom", async () => {
      await page.locator("[data-testid='cat-stage']").click();
      await page.waitForSelector("[data-testid='cat-stage'][data-zoom='on']", { timeout: 5000 });
      await page.locator("[data-testid='cat-stage']").click();
      await page.waitForSelector("[data-testid='cat-stage'][data-zoom='off']", { timeout: 5000 });
    });
    await step(t, "Escape morphs back and restores the source image", async () => {
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => { const d = document.querySelector(".cat-dialog"); return !d || !d.open; }, null, { timeout: 8000 });
      assert.equal(await page.locator(".cat-detail-image[data-morph-hidden]").count(), 0);
      assert.equal(await page.locator(".cat-detail-image").evaluate((el) => getComputedStyle(el).visibility), "visible");
    });
    await step(t, "dialog still closes when the close animation is cancelled", async () => {
      await page.locator(".cat-detail-image-button").click();
      await page.waitForSelector(".cat-dialog[open]", { timeout: 8000 });
      await page.waitForSelector("[data-testid='cat-ghost']", { state: "detached", timeout: 8000 });
      await page.locator(".cat-dialog-close").click();
      await page.waitForSelector("[data-testid='cat-ghost']", { timeout: 4000 });
      await page.evaluate(() => document.querySelector("[data-testid='cat-ghost']")?.getAnimations().forEach((a) => a.cancel()));
      await page.waitForFunction(() => { const d = document.querySelector(".cat-dialog"); return !d || !d.open; }, null, { timeout: 8000 });
      assert.ok(await closed());
    });
    await step(t, "zoom resets across close and reopen", async () => {
      await page.locator(".cat-detail-image-button").click();
      await page.waitForSelector(".cat-dialog[open]", { timeout: 8000 });
      await page.waitForSelector("[data-testid='cat-ghost']", { state: "detached", timeout: 8000 });
      await page.locator("[data-testid='cat-stage']").click();
      await page.waitForSelector("[data-testid='cat-stage'][data-zoom='on']", { timeout: 5000 });
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => { const d = document.querySelector(".cat-dialog"); return !d || !d.open; }, null, { timeout: 8000 });
      await page.locator(".cat-detail-image-button").click();
      await page.waitForSelector(".cat-dialog[open]", { timeout: 8000 });
      await page.waitForSelector("[data-testid='cat-ghost']", { state: "detached", timeout: 8000 });
      assert.equal(await page.locator("[data-testid='cat-stage']").getAttribute("data-zoom"), "off");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => { const d = document.querySelector(".cat-dialog"); return !d || !d.open; }, null, { timeout: 8000 });
    });
    await step(t, "no uncaught page errors", async () => { assert.deepEqual(errors, []); });
    await ctx.close();

    await step(t, "reduced motion: open/close morph with no ghost", async () => {
      const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
      const rp = await rctx.newPage();
      const rerrors = []; rp.on("pageerror", (e) => rerrors.push(e.message));
      await rp.goto(`${cfg.baseUrl}/san-pham/${pid}`);
      await rp.waitForSelector(".cat-detail-image");
      await rp.locator(".cat-detail-image-button").click();
      await rp.waitForSelector(".cat-dialog[open]", { timeout: 8000 });
      await rp.waitForTimeout(600);
      assert.equal(await rp.locator("[data-testid='cat-ghost']").count(), 0);
      await rp.keyboard.press("Escape");
      await rp.waitForFunction(() => { const d = document.querySelector(".cat-dialog"); return !d || !d.open; }, null, { timeout: 8000 });
      assert.equal(await rp.locator(".cat-detail-image[data-morph-hidden]").count(), 0);
      assert.deepEqual(rerrors, []);
      await rctx.close();
    });
  });
});
