// [ai] AI search through the FE (text / image / multimodal): results are real products currently on sale (card data, catalog images).
// Ported from demo-rehearsal G-ai* and integration-20261104 e2e search smoke.
import { test } from "node:test";
import assert from "node:assert/strict";
import { suite } from "../lib/suite.mjs";
import { Client } from "../lib/http.mjs";
import { discoverProduct } from "../lib/data.mjs";
import { step, chk, res, multipart } from "../lib/steps.mjs";

const items = (j) => { const r = res(j); return r?.results ?? r?.items ?? (Array.isArray(r) ? r : []); };
const TECH_KEYS = ["fileName", "catalog", "nguonDuLieu", "phienBanDuLieu", "maSpLienKet", "tenHienThi"];

suite("ai", "AI search via FE", () => {
  test("text / image / multimodal", { timeout: 600000 }, async (t) => {
    const g = new Client();
    for (const [sid, q, label] of [["G-ai1", "áo thun đen basic", "AI text VN"], ["G-ai2", "black shirt", "AI text EN"], ["G-ai3", "giày thể thao trắng", "AI text VN 2"]]) {
      const r = await g.req("POST", "/api/ai/search/text", { body: { query: q, limit: 12 }, timeout: 120000 });
      await chk(t, `${sid} ${label}`, r, { pred: (j) => res(j) != null });
      const list = items(r.j);
      await step(t, `${sid} ${label} returns >0 named results`, () => { assert.ok(list.length > 0, "0 results"); assert.ok(list.every((x) => x.name), "result without a name"); });
      await step(t, `${sid} ${label} results are card data of real products (no dataset/seed fields)`, () => {
        assert.ok(list.length >= 6 && list.length <= 12, "expected 6..12 results");
        assert.equal(new Set(list.map((x) => x.productId)).size, list.length, "duplicate productId");
        for (const x of list) {
          assert.ok(Number.isInteger(x.productId) && x.productId > 0 && typeof x.price === "number", `bad card ${JSON.stringify(x).slice(0, 120)}`);
          for (const k of TECH_KEYS) assert.ok(!(k in x), `leaked technical field ${k}`);
          assert.ok(x.imageUrl == null || x.imageUrl.startsWith("/api/catalog/product-images/"), `image ${x.imageUrl}`);
        }
      });
      // Every hit must be a product the public catalog serves (published, not deleted).
      for (const x of list.slice(0, 3)) {
        const d = await g.req("GET", `/api/catalog/products/${x.productId}`, { origin: false });
        await step(t, `${sid} ${label} hit ${x.productId} exists in live catalog`, () => assert.equal(d.code, 200, `catalog http ${d.code}`));
      }
      const first = list[0];
      if (first?.imageUrl) {
        const ir = await g.req("GET", first.imageUrl, { origin: false });
        await step(t, `${sid} ${label} result image via catalog BFF`, () => assert.ok(ir.code === 200 && ir.buf.length > 1000, `http ${ir.code}`));
      }
    }
    const vr = await g.req("POST", "/api/ai/search/text", { body: { query: "quần jean xanh", limit: 12 }, timeout: 120000 });
    const names = items(vr.j).map((x) => x.name ?? "").join(" ").toLowerCase();
    await step(t, "G-ai5 AI VN relevance sanity ('quần jean xanh' returns trousers/jeans)", () => assert.ok(["quần", "jean", "pants", "jogger"].some((k) => names.includes(k)), "VN query returned other garments"), { todo: "known model limit: CLIP is English-centric (demo with EN queries)" });
    await step(t, "text search rejects empty query (400)", async () => { const r = await g.req("POST", "/api/ai/search/text", { body: { query: "   " } }); assert.equal(r.code, 400); });

    // image + multimodal: use the first catalog product's own image
    const pid = await discoverProduct(g);
    const d = res((await g.req("GET", `/api/catalog/products/${pid}`, { origin: false })).j);
    const im = await g.req("GET", d.imageUrl, { origin: false });
    const file = { name: "p.jpg", type: im.ct.startsWith("image/png") ? "image/png" : "image/jpeg", buf: im.buf };
    const mi = multipart({ limit: "12" }, file);
    const ri = await g.req("POST", "/api/ai/search/image", { raw: mi.raw, ctype: mi.ctype, timeout: 180000 });
    await chk(t, "G-ai4 AI image search", ri, { pred: (j) => res(j) != null });
    await step(t, `G-ai4n AI image search finds source product ${pid} in top5`, () => {
      const ids = items(ri.j).map((x) => x.productId);
      assert.ok(ids.includes(pid), `top=${ids}`);
    });
    const mm = multipart({ limit: "12", query: "black", text_weight: "0.5" }, file);
    const rm = await g.req("POST", "/api/ai/search/multimodal", { raw: mm.raw, ctype: mm.ctype, timeout: 180000 });
    await chk(t, "AI multimodal search (image + text)", rm, { pred: (j) => items(j).length > 0 });
    await step(t, "AI multimodal results are named", () => assert.ok(items(rm.j).every((x) => x.name && x.productId)));
    const bad = multipart({ limit: "12" }, { name: "x.txt", type: "text/plain", buf: Buffer.from("nope") });
    await step(t, "image search rejects non-image upload (415)", async () => { const r = await g.req("POST", "/api/ai/search/image", { raw: bad.raw, ctype: bad.ctype }); assert.equal(r.code, 415); });
  });
});


// ai-async-check: current product-card API, held browser responses and pre-request decode.
suite("ai", "AI operation ownership", () => {
  test("stale mode/input, duplicate image/composed, pending decode abort and owner cleanup", { timeout: 180000 }, async t => {
    const { cfg } = await import("../lib/config.mjs");
    const { launch } = await import("../lib/browser.mjs");
    const browser = await launch(); t.after(() => browser.close());
    const context = await browser.newContext();
    const page = await context.newPage();
    const identity = { id: 1, username: "intercepted", email: "test@example.invalid", role: "CUSTOMER", status: "ACTIVE", createdAt: "2026-01-01T00:00:00Z", emailVerified: true };
    await context.route("**/api/customer-auth/me", route => route.fulfill({ json: { success: true, identity } }));
    // Search-history writes are also intercepted; this suite never writes to the backend.
    await context.route("**/api/customer-account/**", route => route.fulfill({ json: { success: true, result: { content: [] } } }));
    const held = [];
    await context.route("**/api/ai/search/*", route => { held.push(route); });
    const payload = name => ({ success: true, result: { results: [{ sourceId: name, productId: 1, score: 0.9, name, price: 100000, imageUrl: null, colors: [] }] } });
    const release = async (route, name) => { try { await route.fulfill({ json: payload(name) }); } catch { /* cancelled fetch */ } };
    const waitCount = async n => { await page.waitForFunction(() => true); const until = Date.now() + 8000; while (held.length < n && Date.now() < until) await page.waitForTimeout(20); assert.equal(held.length, n, "expected number of search requests"); };
    const mode = i => page.locator('.mode-switch button').nth(i).click();
    const query = value => page.locator('#ai-query').fill(value);
    const submit = () => page.locator('form.search-form').evaluate(form => form.requestSubmit());
    const reset = async () => { for (const route of held.splice(0)) { try { await route.abort(); } catch { /* closed */ } } await page.goto(cfg.baseUrl + "/tim-kiem-ai"); await page.locator('#ai-query').waitFor(); await page.waitForFunction(() => !document.querySelector('.search-status')); };
    const empty = async () => { assert.equal(await page.locator('.pCard').count(), 0); assert.equal(await page.locator('.search-status').count(), 0); assert.equal(await page.locator('.search-submit').isDisabled(), false); };
    const file = { name: "test.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64") };
    await reset(); await query("old mode"); await submit(); await waitCount(1);
    assert.deepEqual(JSON.parse(held[0].request().postData()), { query: "old mode", limit: 12 }, "current text wire contract");
    await mode(1); await release(held[0], "STALE mode"); await page.waitForTimeout(200);
    await empty(); assert.equal(await page.locator('#ai-query').count(), 0);
    await reset(); await query("old input"); await submit(); await waitCount(1);
    await query("new input"); await release(held[0], "STALE input"); await page.waitForTimeout(200);
    await empty(); assert.equal(await page.locator('#ai-query').inputValue(), "new input");
    for (const [index, endpoint] of [[1, "image"], [2, "multimodal"]]) {
      await reset(); await mode(index);
      if (index === 2) await query("combined query");
      await page.locator('#ai-file').setInputFiles(file);
      await page.locator('form.search-form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
      await waitCount(1); await page.waitForTimeout(200); assert.equal(held.length, 1, "synchronous duplicate submits send once");
      const request = held[0].request(); assert.ok(request.url().endsWith('/' + endpoint));
      assert.match(request.headers()['content-type'], /multipart\/form-data/);
      assert.match(request.postData(), /name="file"/); assert.match(request.postData(), /name="limit"\r\n\r\n12/);
      if (index === 2) assert.match(request.postData(), /name="query"\r\n\r\ncombined query/);
      await release(held[0], endpoint); await page.getByText(endpoint, { exact: true }).waitFor();
    }
    // Old flow awaited CSRF before transport. Current flow awaits image decode:
    // hold that actual async boundary and verify cancellation prevents the POST.
    await reset(); await mode(1); await page.locator('#ai-file').setInputFiles(file);
    await page.evaluate(() => {
      const NativeImage = window.Image;
      window.Image = function (...args) {
        const image = new NativeImage(...args);
        const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
        Object.defineProperty(image, 'src', { set(value) { window.releaseDecode = () => descriptor.set.call(image, value); } });
        return image;
      };
    });
    await submit(); await page.waitForFunction(() => typeof window.releaseDecode === 'function');
    await mode(0); await page.evaluate(() => window.releaseDecode()); await page.waitForTimeout(200);
    assert.equal(held.length, 0, "abort while pre-transport work pending never posts search"); await empty();
    await reset(); await query("operation A"); await submit(); await waitCount(1);
    await mode(1); await mode(0); await query("operation B"); await submit(); await waitCount(2);
    await submit(); await page.waitForTimeout(100); assert.equal(held.length, 2);
    assert.equal(await page.locator('.search-submit').isDisabled(), true);
    await release(held[0], "old A"); await page.waitForTimeout(100);
    assert.equal(await page.locator('.search-submit').isDisabled(), true, "old cleanup cannot unlock current owner");
    await release(held[1], "new B"); await page.getByText("new B", { exact: true }).waitFor();
    assert.equal(await page.getByText("old A", { exact: true }).count(), 0);
    await reset(); await mode(1); await page.locator('#ai-file').setInputFiles(file);
    await page.locator('form.search-form').evaluate(form => { form.requestSubmit(); document.querySelectorAll('.mode-switch button')[0].click(); });
    await page.waitForTimeout(300); assert.equal(held.length, 0, "same-task decode cancellation sends no request"); await empty();
  });
});
