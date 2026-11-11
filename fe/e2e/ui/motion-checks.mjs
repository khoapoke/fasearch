// Ported from catalog-motion-completion/live/combined/verify-motion/verify.mjs (59 checks).
// Assertions/logic are kept as in the source harness; only plumbing changed (env-driven base URL,
// shared browser, results returned through `check`, screenshots go to the run dir via SHOT).
export async function runMotionChecks({ browser, base, check, SHOT }) {
  const BASE = base;
  const rec = check;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function ctx(w, h, opts = {}) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
    if (opts.off) await c.addInitScript(() => localStorage.setItem("fa-motion", "off"));
    return c;
  }
  const compact = (p) => p.getAttribute("header.chHeader", "data-compact");
  const op = (p, sel) => p.$eval(sel, (e) => getComputedStyle(e).opacity);

  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const tag = `${w}`;
    // --- navbar + marquee, motion auto
    {
      const c = await ctx(w, h); const p = await c.newPage();
      await p.goto(BASE + "/", { waitUntil: "networkidle" });
      rec(`${tag} nav top expanded`, (await compact(p)) === "false");
      await p.evaluate(() => window.scrollTo(0, 120)); await sleep(150);
      await p.evaluate(() => window.scrollTo(0, 700)); await sleep(500);
      rec(`${tag} nav collapses on scroll down`, (await compact(p)) === "true");
      rec(`${tag} side clusters hidden when compact`, (await op(p, ".chLeft")) === "0" || +(await op(p, ".chLeft")) < 0.05);
      await p.screenshot({ path: SHOT(`nav-compact-${tag}.png`) });
      await p.evaluate(() => window.scrollBy(0, -10)); await sleep(150);
      rec(`${tag} no reveal on <24px up (hysteresis)`, (await compact(p)) === "true");
      await p.evaluate(() => window.scrollBy(0, -40)); await sleep(500);
      rec(`${tag} nav reveals after >=24px up`, (await compact(p)) === "false");
      await p.screenshot({ path: SHOT(`nav-revealed-${tag}.png`) });
      await p.evaluate(() => window.scrollTo(0, 900)); await sleep(500);
      rec(`${tag} nav re-collapses`, (await compact(p)) === "true");
      await p.focus("a.chBrand"); await sleep(500);
      rec(`${tag} focus on logo reveals clusters`, +(await op(p, ".chRight")) === 1 && +(await op(p, ".chLeft")) === 1);
      await p.keyboard.press("Tab"); await sleep(100);
      rec(`${tag} stays revealed while focus within`, +(await op(p, ".chRight")) === 1);
      await p.evaluate(() => window.scrollBy(0, 300)); await sleep(300);
      rec(`${tag} focus-within freezes (no collapse reflow of controls)`, +(await op(p, ".chRight")) === 1);
      await p.evaluate(() => document.activeElement?.blur()); await sleep(100);
      // marquee
      await p.evaluate(() => document.querySelector("#thuong-hieu").scrollIntoView()); await sleep(600);
      const vp = ".hmBrandsViewport";
      const state = () => p.$eval(vp, (e) => ({ paused: e.dataset.paused, ps: getComputedStyle(e.querySelector(".hmBrandTrack")).animationPlayState }));
      const s0 = await state();
      rec(`${tag} marquee runs in view`, s0.paused === "false" && s0.ps === "running", JSON.stringify(s0));
      const box = await (await p.$(vp)).boundingBox();
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await sleep(200);
      const s1 = await state();
      rec(`${tag} marquee pauses on hover`, s1.paused === "true" && s1.ps === "paused", JSON.stringify(s1));
      await p.mouse.move(2, 2); await sleep(200);
      rec(`${tag} marquee resumes after hover`, (await state()).ps === "running");
      await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); }); await sleep(200);
      rec(`${tag} marquee paused on hidden tab`, (await state()).ps === "paused");
      await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); }); await sleep(200);
      // keyboard focus inside viewport: inject focusable and focus
      await p.evaluate(() => { const b = document.createElement("button"); b.id = "tmpf"; b.textContent = "x"; document.querySelector(".hmBrandsViewport").prepend(b); });
      await p.focus("#tmpf"); await sleep(200);
      rec(`${tag} marquee pauses on keyboard focus`, (await state()).ps === "paused");
      await p.evaluate(() => document.querySelector("#tmpf").remove());
      await p.screenshot({ path: SHOT(`marquee-${tag}.png`) });
      // live Motion Off through theme menu
      await p.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
      await p.click(".chThemeBtn"); await sleep(100);
      await p.screenshot({ path: SHOT(`theme-menu-motion-${tag}.png`) });
      await p.click("text=Tắt chuyển động"); await sleep(300);
      rec(`${tag} live Off sets html[data-motion=off]`, (await p.getAttribute("html", "data-motion")) === "off");
      rec(`${tag} live Off: marquee becomes static`, (await p.$(".hmBrandsViewport")) === null && (await p.$(".hmBrandsStatic")) !== null);
      await p.evaluate(() => window.scrollTo(0, 800)); await sleep(400);
      rec(`${tag} live Off: nav does not collapse`, (await compact(p)) === "false");
      const ls = await p.evaluate(() => localStorage.getItem("fa-motion"));
      rec(`${tag} Off persisted in localStorage`, ls === "off");
      await p.reload({ waitUntil: "networkidle" });
      rec(`${tag} Off survives reload (boot script)`, (await p.getAttribute("html", "data-motion")) === "off");
      await c.close();
    }
    // --- reduced motion
    {
      const c = await ctx(w, h, { reduced: true }); const p = await c.newPage();
      await p.goto(BASE + "/", { waitUntil: "networkidle" });
      await p.evaluate(() => window.scrollTo(0, 800)); await sleep(500);
      rec(`${tag} reduced: nav does not collapse`, (await compact(p)) === "false");
      rec(`${tag} reduced: marquee static`, (await p.$(".hmBrandsViewport")) === null);
      const d = await p.$eval(".hmCta", (e) => getComputedStyle(e).transitionDuration);
      rec(`${tag} reduced: CTA transition ~0`, parseFloat(d) < 0.001, d);
      const run = await p.$$eval(".hmBrandTrack", (els) => els.map((e) => getComputedStyle(e).animationName));
      rec(`${tag} reduced: no running track animation`, run.every((n) => n === "none"), JSON.stringify(run));
      await c.close();
    }
    // --- Off from storage on load
    {
      const c = await ctx(w, h, { off: true }); const p = await c.newPage();
      await p.goto(BASE + "/", { waitUntil: "networkidle" });
      const d = await p.$eval(".hmCta", (e) => getComputedStyle(e).transitionDuration);
      rec(`${tag} off: CTA transition ~0`, parseFloat(d) < 0.001, d);
      const anim = await p.$$eval(".hmBrandTrack", (els) => els.map((e) => getComputedStyle(e).animationName));
      rec(`${tag} off: no track animation`, anim.every((n) => n === "none"), JSON.stringify(anim));
      await c.close();
    }
  }

  // CTA + qty (desktop, motion auto)
  {
    const c = await ctx(1440, 900); const p = await c.newPage();
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    const t = (sel) => p.$eval(sel, (e) => getComputedStyle(e).transform);
    await p.hover(".hmCta"); await sleep(250);
    rec("CTA hover lifts (home .hmCta)", (await t(".hmCta")).includes("-1"), await t(".hmCta"));
    await p.mouse.down(); await sleep(250);
    rec("CTA press scales (home .hmCta)", (await t(".hmCta")).startsWith("matrix(0.97"), await t(".hmCta"));
    await p.mouse.up();
    await p.goto(BASE + "/tim-kiem-ai", { waitUntil: "networkidle" });
    const sub = await p.$(".search-submit");
    if (sub && !(await sub.isDisabled())) {
      await sub.hover(); await sleep(250);
      rec("AI search submit hover lifts", (await t(".search-submit")).includes("-1"), await t(".search-submit"));
    } else rec("AI search submit hover lifts (disabled w/o input: no transform)", sub ? (await t(".search-submit")) === "none" : false, sub ? await t(".search-submit") : "missing");
    await p.goto(BASE + "/san-pham/3129", { waitUntil: "networkidle" }); await sleep(800);
    const minus = 'button[aria-label="Giảm số lượng"]', plus = 'button[aria-label="Tăng số lượng"]';
    rec("PDP minus disabled at 1", await p.isDisabled(minus));
    const w0 = (await (await p.$(".cat-stepper")).boundingBox()).width;
    await p.click(plus); await sleep(250);
    const w1 = (await (await p.$(".cat-stepper")).boundingBox()).width;
    rec("PDP plus -> 2, minus enabled", (await p.$eval(".cat-stepper .qty-tick", (e) => e.textContent)) === "2" && !(await p.isDisabled(minus)));
    for (let i = 0; i < 8; i++) await p.click(plus);
    const w2 = (await (await p.$(".cat-stepper")).boundingBox()).width;
    rec("PDP stepper width stable 1->2->10", w0 === w1 && w1 === w2, `${w0}/${w1}/${w2}`);
    await p.hover(plus); await p.mouse.down(); await sleep(250);
    rec("PDP stepper press scales", (await t(plus)).startsWith("matrix(0.97"), await t(plus));
    await p.mouse.up();
    await p.focus(minus); await p.keyboard.press("Enter"); await sleep(150);
    rec("PDP stepper keyboard Enter decrements", (await p.$eval(".cat-stepper .qty-tick", (e) => e.textContent)) === "10");
    await p.keyboard.press("Tab"); await p.keyboard.press("Tab");
    const ring = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineWidth + " " + s.outlineStyle; });
    rec("Keyboard focus ring visible on stepper/CTA", /px solid/.test(ring) && !ring.startsWith("0px"), ring);
    await p.screenshot({ path: SHOT("pdp-stepper.png") });
    const cta = ".cat-primary";
    await p.focus(cta); await p.keyboard.press("Shift+Tab"); await p.keyboard.press("Tab");
    await p.screenshot({ path: SHOT("pdp-cta-focus.png") });
    await c.close();
  }
}
