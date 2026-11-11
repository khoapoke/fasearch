// Ported from catalog-motion-completion/live/combined/verify-motion/toggle.mjs.
// Assertions/logic are kept as in the source harness; only plumbing changed (env-driven base URL,
// shared browser, results returned through `check`, screenshots go to the run dir via SHOT).
export async function runMotionToggleChecks({ browser, base, check, SHOT }) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const b = browser;
  for (const [label, vw, vh] of [["1440", 1440, 1000], ["390", 390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh } }); const p = await ctx.newPage();
    await p.goto(base + "/nam", { waitUntil: "networkidle" });
    const sel = vw > 800 ? ".cat-filter-desktop fieldset .cat-slide-opts" : ".cat-filter-mobile fieldset .cat-slide-opts";
    if (vw <= 800) await p.locator(".cat-filter-mobile > summary").click();
    await p.waitForFunction((s) => document.querySelectorAll(s + " .cat-filter-option").length > 4, sel);
    const state = () => p.evaluate((s) => { const g = document.querySelector(s); const bg = g.querySelector(".cat-selbg"); const a = g.querySelector("[data-active='true']"); return { attr: document.documentElement.getAttribute("data-motion"), box: g.getAttribute("data-motion"), y: new DOMMatrixReadOnly(getComputedStyle(bg).transform).m42, top: a.offsetTop, dur: getComputedStyle(bg).transitionDuration }; }, sel);
    const clickRow = async (n) => { await p.locator(sel + " .cat-filter-option").nth(n).click(); await sleep(40); const mid = await state(); await sleep(900); return { mid, end: await state() }; };
    let r = await clickRow(3);
    check(`${label}: motion ON animates in transit`, Math.abs(r.mid.y - r.end.top) > 1 && r.end.box === "on", JSON.stringify(r.mid));
    // toggle OFF through the real menu, same tab
    await p.locator('button[aria-label^="Giao diện"]').first().click();
    await p.locator('button[aria-pressed]', { hasText: /Chuyển động|Tắt chuyển động|Motion/i }).first().click();
    await sleep(200);
    let s = await state();
    check(`${label}: after menu toggle OFF (no reload) html[data-motion=off] + underlay box off`, s.attr === "off" && s.box === "off", JSON.stringify(s));
    await p.keyboard.press("Escape"); await sleep(100);
    r = await clickRow(1);
    check(`${label}: motion OFF snaps (no in-flight motion)`, Math.abs(r.mid.y - r.end.top) < 1, JSON.stringify(r.mid));
    await p.screenshot({ path: SHOT(`toggle-off-${label}.png`) });
    // toggle back ON
    await p.locator('button[aria-label^="Giao diện"]').first().click();
    await p.locator('button[aria-pressed]', { hasText: /Chuyển động|Tắt chuyển động|Motion/i }).first().click();
    await sleep(200); await p.keyboard.press("Escape"); await sleep(100);
    s = await state();
    check(`${label}: toggle ON again restores, no reload`, s.attr === null && s.box === "on", JSON.stringify(s));
    r = await clickRow(4);
    check(`${label}: motion ON animates again`, Math.abs(r.mid.y - r.end.top) > 1 && Math.abs(r.end.y - r.end.top) < 1, JSON.stringify(r.mid));
    await ctx.close();
  }
}
