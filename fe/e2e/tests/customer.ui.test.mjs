// [customer] Browser checks: catalog filters/pager/price/search/selection (incl. reduced + Motion Off),
// motion (navbar, marquee, theme menu, PDP stepper/CTA, Off toggle) and nav listing pages.
// The catalog/motion check bodies are ported from catalog-motion-completion/live/combined/verify-*/.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cfg } from "../lib/config.mjs";
import { suite } from "../lib/suite.mjs";
import { launch, collector, emit, shotDir, finishShots } from "../lib/browser.mjs";
import { step } from "../lib/steps.mjs";
import { runCatalogChecks } from "../ui/catalog-checks.mjs";
import { runMotionChecks } from "../ui/motion-checks.mjs";
import { runMotionToggleChecks } from "../ui/motion-toggle-checks.mjs";

suite("customer", "storefront UI", () => {
  let browser;
  before(async () => { browser = await launch(); });
  after(async () => { await browser?.close(); });

  // Capability probe: older builds (e.g. the frozen baseline) have no catalog filter panel / motion layer.
  async function probe() {
    const c = await browser.newContext(); const p = await c.newPage();
    await p.goto(cfg.baseUrl + "/nam", { waitUntil: "networkidle" });
    const r = { catalog: (await p.locator(".cat-filter-desktop").count()) > 0 };
    await p.goto(cfg.baseUrl + "/", { waitUntil: "networkidle" });
    r.motion = (await p.locator("header.chHeader").count()) > 0;
    await c.close();
    return r;
  }

  async function runPorted(t, name, fn, capability) {
    const cap = await probe();
    if (!cap[capability]) return t.skip(`build lacks the ${capability} UI (feature probe on ${cfg.baseUrl})`);
    const { check, results } = collector(); const { dir, SHOT } = shotDir(name);
    try { await fn({ browser, base: cfg.baseUrl, check, SHOT }); }
    catch (e) { results.push({ name: `${name} aborted: ${String(e.message).split("\n")[0]}`, ok: false, detail: "" }); }
    await emit(t, results);
    finishShots(dir, results.some((r) => !r.ok));
  }

  test("catalog filters / pager / price / search / selection (desktop + mobile, reduced, Motion Off)", { timeout: 900000 }, (t) => runPorted(t, "catalog", runCatalogChecks, "catalog"));
  test("motion: navbar, marquee, theme menu, PDP CTA, reduced/Off", { timeout: 600000 }, (t) => runPorted(t, "motion", runMotionChecks, "motion"));
  test("motion: same-tab Motion Off/On toggle follows live", { timeout: 300000 }, (t) => runPorted(t, "motion-toggle", runMotionToggleChecks, "catalog"));

  test("nav listing pages show products without the retired legacy proxy", async (t) => {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    for (const path of ["/nu", "/hang-moi", "/sale", "/bo-suu-tap"]) {
      const p = await c.newPage();
      await p.goto(cfg.baseUrl + path, { waitUntil: "networkidle" });
      await p.waitForTimeout(500);
      const info = await p.evaluate(() => ({ links: document.querySelectorAll('a[href*="/san-pham/"]').length, legacy: /Legacy proxy|Không kết nối|0 sản phẩm/i.test(document.body.innerText) }));
      await step(t, `Nav listings ${path} load products`, () => assert.ok(info.links > 0 && !info.legacy, `product links=${info.links} legacyText=${info.legacy}`));
      await p.close();
    }
    await c.close();
  });
});
