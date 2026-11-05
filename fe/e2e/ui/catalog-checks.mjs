// Ported from catalog-motion-completion/live/combined/verify-catalog/verify.mjs (76 checks).
// Assertions/logic are kept as in the source harness; only plumbing changed (env-driven base URL,
// shared browser, results returned through `check`, screenshots go to the run dir via SHOT).
export async function runCatalogChecks({ browser, base, check, SHOT }) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const BASE = base + "/nam";
  async function open(opts = {}, url = BASE) {
    const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1440, height: 1000 }, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
    if (opts.motionOff) await ctx.addInitScript(() => localStorage.setItem("fa-motion", "off"));
    const page = await ctx.newPage();
    const reqs = [];
    page.on("request", (r) => { if (r.url().includes("/api/catalog/products")) reqs.push({ t: Date.now(), url: r.url() }); });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelectorAll(".cat-filter-desktop fieldset .cat-filter-option, .cat-filter-mobile fieldset .cat-filter-option").length > 4 && (document.querySelectorAll(".cat-product-card").length > 0 || /[?]/.test(location.href)), null, { timeout: 15000 });
    return { ctx, page, reqs };
  }
  const q = (u) => new URL(u, "http://x").searchParams;
  const rect = (page, sel, nth = 0) => page.locator(sel).nth(nth).evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right }; });

  // ---------- Desktop ----------
  {
    const { ctx, page, reqs } = await open();
    const panel = page.locator(".cat-filter-desktop");
    await panel.locator("summary", { hasText: "Thương hiệu" }).click();
    await sleep(300);
    // 1 spacing / clipping
    const search = await rect(page, ".cat-filter-desktop .cat-brand-search input");
    const firstBrand = await rect(page, ".cat-filter-desktop .cat-brand-body .cat-filter-option");
    check("D1 gap brand-search → first option ≥ 12px", firstBrand.y - search.b >= 12, `${(firstBrand.y - search.b).toFixed(1)}px`);
    const catLegend = await rect(page, ".cat-filter-desktop legend");
    const catFirst = await rect(page, ".cat-filter-desktop .cat-filter-option");
    check("D1 gap legend → 'Tất cả' ≥ 10px", catFirst.y - (catLegend.b) >= 10, `${(catFirst.y - catLegend.b).toFixed(1)}px`);
    const gaps = await page.evaluate(() => [...document.querySelectorAll(".cat-filter-desktop .cat-slide-opts")].map((g) => { const o = [...g.querySelectorAll(".cat-filter-option")].map((e) => e.getBoundingClientRect()); let min = 99; for (let i = 1; i < o.length; i++) min = Math.min(min, o[i].top - o[i - 1].bottom); return min; }));
    check("D1 option rows do not touch (gap ≥ 2px)", gaps.every((g) => g >= 2), JSON.stringify(gaps));
    const clip = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll(".cat-filter-desktop .cat-filter-option, .cat-filter-desktop .cat-input, .cat-filter-desktop .cat-price-thumb").forEach((el) => {
        const r = el.getBoundingClientRect();
        for (let p = el.parentElement; p && !p.classList.contains("catPage"); p = p.parentElement) {
          const cs = getComputedStyle(p);
          if (cs.overflowX !== "visible" || cs.overflowY !== "visible") { const pr = p.getBoundingClientRect(); if (r.left < pr.left - 0.5 || r.right > pr.right + 0.5 || r.top < pr.top - 0.5 || r.bottom > pr.bottom + 0.5) bad.push(el.className + " in " + p.className); }
        }
      });
      const nested = [...document.querySelectorAll(".cat-filter-desktop *")].filter((e) => { const o = getComputedStyle(e).overflowY; return (o === "auto" || o === "scroll") && e.scrollHeight > e.clientHeight; }).length;
      return { bad, nested };
    });
    check("D1 no clipped options / no nested scroll", clip.bad.length === 0 && clip.nested === 0, JSON.stringify(clip));
    // keyboard focus ring not clipped: focus first brand radio
    await page.locator(".cat-filter-desktop .cat-brand-body input[type=radio]").first().focus();
    await page.keyboard.press("ArrowDown"); await page.waitForTimeout(700);
    check("D5 keyboard ArrowDown picks next brand → URL brand", !!q(page.url()).get("brand"), page.url());
    await page.screenshot({ path: SHOT("desktop-keyboard-brand.png"), clip: { x: 0, y: 150, width: 420, height: 900 } });
    await page.locator(".cat-filter-desktop .cat-filter-reset").click(); await page.waitForTimeout(700);
    check("D3 reset clears brand param", !q(page.url()).get("brand"));

    // 3 price default
    check("D3 default URL has no price params", !q(page.url()).get("minPrice") && !q(page.url()).get("maxPrice"));
    check("D3 default request has no price params", reqs.every((r) => !q(r.url).get("minPrice") && !q(r.url).get("maxPrice")));
    check("D3 readout 'Mọi mức giá', inputs empty", (await page.locator(".cat-filter-desktop .cat-price-readout").innerText()) === "Mọi mức giá" && (await page.locator("#desktop-price-min").inputValue()) === "" && (await page.locator("#desktop-price-max").inputValue()) === "");
    const scale = await page.locator(".cat-filter-desktop .cat-price-scale").innerText();
    const ext = await page.evaluate(async () => { const f = async (s) => (await (await fetch("/api/catalog/products?size=1&sort=" + s)).json()).result.content[0].price; return [await f("price,asc"), await f("price,desc")]; });
    check("D3 scale = real data extent", scale.replace(/\D/g, " ").trim().split(/\s+/).join("").includes(String(ext[0])) , `${scale.replace(/\n/g, " ")} vs ${ext}`);
    // drag min thumb
    const tr = await rect(page, ".cat-filter-desktop .cat-price-track");
    const th = await rect(page, ".cat-filter-desktop .cat-price-thumb", 0);
    await page.mouse.move(th.x + th.w / 2, th.y + th.h / 2); await page.mouse.down();
    await page.mouse.move(tr.x + tr.w * 0.3, th.y + 10, { steps: 6 });
    const before = q(page.url()).get("minPrice");
    const midInput = await page.locator("#desktop-price-min").inputValue();
    await page.mouse.up(); await page.waitForTimeout(800);
    const minP = q(page.url()).get("minPrice");
    check("D3 drag does not commit until release", before === null && midInput !== "", `mid input=${midInput}`);
    check("D3 release commits minPrice only", !!minP && !q(page.url()).get("maxPrice"), page.url());
    check("D3 numeric input synced with slider", (await page.locator("#desktop-price-min").inputValue()) === minP);
    // numeric input Enter
    await page.locator("#desktop-price-max").fill("2000000"); await page.keyboard.press("Enter"); await page.waitForTimeout(800);
    check("D3 numeric Enter commits maxPrice + thumb moved", q(page.url()).get("maxPrice") === "2000000");
    await page.locator("#desktop-price-min").fill("3000000"); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
    check("D3 min>max rejected with alert, no commit", (await page.locator(".cat-filter-desktop .cat-price-error").count()) === 1 && q(page.url()).get("minPrice") === minP);
    await page.screenshot({ path: SHOT("desktop-price-committed.png"), clip: { x: 0, y: 700, width: 420, height: 400 } });
    await page.locator(".cat-filter-desktop .cat-filter-reset").click(); await page.waitForTimeout(800);
    check("D3 reset removes price params", !q(page.url()).get("minPrice") && !q(page.url()).get("maxPrice") && page.url().endsWith("/nam"), page.url());
    // keyboard slider
    await page.locator(".cat-filter-desktop .cat-price-thumb").first().focus();
    await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(600);
    check("D3 keyboard slider commits minPrice after keyup", !!q(page.url()).get("minPrice"), page.url());
    await page.locator(".cat-filter-desktop .cat-filter-reset").click(); await page.waitForTimeout(600);
    await ctx.close();
  }

  // ---------- Pagination ----------
  {
    const { ctx, page } = await open();
    check("D2 single page readout (no numbered window)", (await page.locator(".cat-page-btn").count()) === 2 && (await page.locator(".cat-pagination input").count()) === 1);
    check("D2 no 'Đi' button", (await page.locator(".cat-jump-go").count()) === 0);
    await page.locator("#listing-jump").fill("3"); await page.keyboard.press("Enter"); await page.waitForTimeout(900);
    check("D2 Enter → page=2 in URL, input shows 3", q(page.url()).get("page") === "2" && (await page.locator("#listing-jump").inputValue()) === "3", page.url());
    await page.locator("#listing-jump").fill("999999"); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
    check("D2 out-of-range → alert, URL unchanged", (await page.locator(".cat-jump-error").count()) === 1 && q(page.url()).get("page") === "2");
    await page.goBack(); await page.waitForTimeout(900);
    check("D2 Back → previous page state", (q(page.url()).get("page") ?? "0") === "0" && (await page.locator("#listing-jump").inputValue()) === "1", page.url());
    await page.goForward(); await page.waitForTimeout(900);
    check("D2 Forward → page 3", (await page.locator("#listing-jump").inputValue()) === "3");
    await page.locator('button[aria-label="Trang sau"]').click(); await page.waitForTimeout(900);
    check("D2 Next → page 4", (await page.locator("#listing-jump").inputValue()) === "4");
    await page.locator("#listing-jump").fill("77"); await page.keyboard.press("Escape"); await page.waitForTimeout(100);
    check("D2 Esc reverts typed page number", (await page.locator("#listing-jump").inputValue()) === "4");
    check("D2 big number is the input (label)", (await page.locator("#listing-jump").getAttribute("aria-label")) === "Trang hiện tại, nhập số trang" && (await page.locator(".cat-page-cur .cat-corner").count()) === 1 && (await page.locator(".cat-page-pos").count()) === 1);
    // sort + filter preserved when paging
    await page.selectOption("#listing-sort", "price,asc"); await page.waitForTimeout(800);
    await page.locator('button[aria-label="Trang sau"]').click(); await page.waitForTimeout(900);
    check("D2 paging preserves sort", q(page.url()).get("sort") === "price,asc" && q(page.url()).get("page") === "1", page.url());
    await page.screenshot({ path: SHOT("desktop-pager.png"), clip: { x: 300, y: 0, width: 800, height: 1000 }, fullPage: true });
    await ctx.close();
  }

  // ---------- Live search ----------
  {
    const { ctx, page, reqs } = await open();
    const kw = page.locator("#desktop-keyword");
    const n0 = reqs.length;
    await kw.click();
    await kw.pressSequentially("vans", { delay: 120 });
    await sleep(250);
    check("D4 no request during typing burst (debounce)", reqs.slice(n0).every((r) => !q(r.url).get("keyword")), `reqs=${reqs.length - n0}`);
    await sleep(500);
    const kwReqs = reqs.slice(n0).filter((r) => q(r.url).get("keyword") === "vans" && q(r.url).get("size") === "6");
    check("D4 exactly one request with final keyword after ~500ms", kwReqs.length === 1, `n=${kwReqs.length}`);
    check("D4 URL keyword + page reset", q(page.url()).get("keyword") === "vans" && !q(page.url()).get("page"));
    // page reset from page 3
    await page.locator("#listing-jump").fill("2"); await page.keyboard.press("Enter"); await page.waitForTimeout(800);
    await kw.fill("vans x"); await sleep(900);
    check("D4 query change resets page to 1", !q(page.url()).get("page"), page.url());
    // keep results visible during refetch
    await page.route("**/api/catalog/products*", async (route) => { if (route.request().url().includes("keyword=slowone")) await sleep(1200); route.continue(); });
    const cardsBefore = await page.locator(".cat-product-card").count();
    await kw.fill("slowone"); await sleep(700);
    const during = await page.evaluate(() => ({ cards: document.querySelectorAll(".cat-product-card").length, skel: document.querySelectorAll(".cat-skeleton-grid").length, dim: document.querySelector(".cat-results")?.getAttribute("data-refetching") }));
    check("D4 old results stay visible while refetching (no skeleton)", during.cards === cardsBefore && during.skel === 0 && during.dim === "true", JSON.stringify(during));
    await page.screenshot({ path: SHOT("desktop-refetch-dim.png") });
    await sleep(1500);
    // stale race: slow request for "aaaa", fast for "nike"
    await page.unroute("**/api/catalog/products*");
    await page.route("**/api/catalog/products*", async (route) => { if (route.request().url().includes("keyword=aaaa")) await sleep(2500); route.continue(); });
    await kw.fill("aaaa"); await sleep(650);
    await kw.fill("vans slip"); await sleep(900);
    await sleep(2500);
    const names = await page.locator(".cat-product-name").allInnerTexts();
    check("D4 stale slow response ignored; list matches latest query", names.length > 0 && names.every((n) => /slip/i.test(n)), names.slice(0, 3).join(" | "));
    await page.unroute("**/api/catalog/products*");
    // Enter commits immediately
    const n1 = reqs.length;
    await kw.fill("old skool"); await page.keyboard.press("Enter"); await sleep(300);
    check("D4 Enter commits immediately (push)", q(page.url()).get("keyword") === "old skool" && reqs.length > n1);
    // Back restores previous keyword in field
    await page.goBack(); await sleep(900);
    check("D4 Back syncs input to URL keyword", (await kw.inputValue()) === (q(page.url()).get("keyword") ?? ""), await kw.inputValue());
    // IME composition via CDP
    await kw.fill(""); await sleep(800);
    const cdp = await ctx.newCDPSession(page);
    const n2 = reqs.length; await kw.focus();
    await cdp.send("Input.imeSetComposition", { text: "á", selectionStart: 1, selectionEnd: 1 });
    await sleep(650);
    await cdp.send("Input.imeSetComposition", { text: "áo", selectionStart: 2, selectionEnd: 2 });
    await sleep(900);
    const midReqs = reqs.slice(n2).filter((r) => q(r.url).get("keyword")).length;
    check("D4 IME: no commit/request mid-composition (>500ms)", midReqs === 0 && !q(page.url()).get("keyword"), `reqs=${midReqs}`);
    await cdp.send("Input.insertText", { text: "áo" }); await sleep(900);
    check("D4 IME: commits once after composition end", q(page.url()).get("keyword") === "áo" && reqs.slice(n2).filter((r) => q(r.url).get("keyword") === "áo" && q(r.url).get("size") === "6").length === 1, page.url());
    // brand search local + immediate
    await page.locator("summary", { hasText: "Thương hiệu" }).first().click(); await sleep(200);
    const n3 = reqs.length;
    await page.locator(".cat-filter-desktop .cat-brand-search input").fill("ad");
    const t0 = Date.now();
    const opts = await page.locator(".cat-filter-desktop .cat-brand-body .cat-filter-option").allInnerTexts();
    check("D4 brand search narrows immediately & locally (no request)", opts.length > 0 && opts.length < 28 && opts.slice(1).every((o) => /ad/i.test(o)) && reqs.length === n3 && Date.now() - t0 < 300, opts.join(","));
    await ctx.close();
  }

  // ---------- Selection underlay ----------
  async function underlayCheck(label, opts, expectAnimated) {
    const { ctx, page } = await open(opts);
    const sel = ".cat-filter-desktop fieldset .cat-slide-opts";
    const info = () => page.evaluate((s) => { const g = document.querySelector(s); const bg = g.querySelector(".cat-selbg"); const a = g.querySelector("[data-active='true']"); const m = new DOMMatrixReadOnly(getComputedStyle(bg).transform); return { bgY: m.m42, activeTop: a.offsetTop, h: bg.offsetHeight, ah: a.offsetHeight, op: getComputedStyle(bg).opacity, dur: getComputedStyle(bg).transitionDuration, prop: getComputedStyle(bg).transitionProperty }; }, sel);
    let i = await info();
    check(`${label}: initial underlay on 'Tất cả', not animated`, Math.abs(i.bgY - i.activeTop) < 1 && i.op === "1");
    const opts2 = page.locator(`${sel} .cat-filter-option`);
    await opts2.nth(3).click();
    await sleep(30);
    const mid = await info();
    await sleep(900);
    i = await info();
    check(`${label}: settles exactly on selected row`, Math.abs(i.bgY - i.activeTop) < 1 && i.h === i.ah, JSON.stringify(i));
    const animated = Math.abs(mid.bgY - i.activeTop) > 1;
    check(`${label}: ${expectAnimated ? "animates (in transit shortly after click)" : "snaps (no in-flight motion)"}`, animated === expectAnimated, `mid=${mid.bgY} end=${i.activeTop} dur=${i.dur}`);
    check(`${label}: transition only transform/opacity`, /transform/.test(i.prop) && !/height|top|left|width|background|all/.test(i.prop) || /^(0s|1e-05s)/.test(i.dur), i.prop);
    // rapid changes
    for (const n of [1, 5, 2, 6, 0, 4]) { await opts2.nth(n).click({ delay: 0 }); await sleep(40); }
    await sleep(1000); i = await info();
    check(`${label}: rapid clicks end on selected row, single indicator`, Math.abs(i.bgY - i.activeTop) < 1 && (await page.locator(`${sel} .cat-selbg`).count()) === 1);
    // expand list
    await page.locator(".cat-filter-desktop .cat-brand-more").first().click(); await sleep(600);
    i = await info();
    check(`${label}: expanded list keeps indicator on selected row`, Math.abs(i.bgY - i.activeTop) < 1);
    // text stays still: label text position unchanged between active / inactive
    const tx = await page.evaluate((s) => [...document.querySelectorAll(s + " .cat-filter-option span")].map((e) => Math.round(e.getBoundingClientRect().left)), sel);
    check(`${label}: option text left edge identical across rows`, new Set(tx).size === 1, JSON.stringify(tx));
    await page.screenshot({ path: SHOT(`desktop-selection-${label}.png`), clip: { x: 0, y: 150, width: 420, height: 650 } });
    await ctx.close();
  }
  await underlayCheck("normal", {}, true);
  await underlayCheck("reduced", { reduced: true }, false);
  await underlayCheck("motionOff", { motionOff: true }, false);

  // hover / focus / selected distinct
  {
    const { ctx, page } = await open();
    const rows = page.locator(".cat-filter-desktop fieldset .cat-slide-opts .cat-filter-option");
    await rows.nth(2).hover(); await sleep(250);
    const hover = await rows.nth(2).evaluate((e) => getComputedStyle(e).backgroundColor);
    await rows.nth(0).locator("input").focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
    const focus = await rows.nth(0).evaluate((e) => ({ outline: getComputedStyle(e).outlineStyle + " " + getComputedStyle(e).outlineWidth, bg: getComputedStyle(e).backgroundColor }));
    const sel = await page.evaluate(() => getComputedStyle(document.querySelector(".cat-filter-desktop .cat-selbg")).backgroundColor);
    check("D5 hover, focus ring, selected visuals are distinct", hover !== "rgba(0, 0, 0, 0)" && /solid 2px/.test(focus.outline) && hover !== sel, `hover=${hover} focus=${focus.outline} sel=${sel}`);
    await page.screenshot({ path: SHOT("desktop-hover-focus.png"), clip: { x: 0, y: 150, width: 420, height: 450 } });
    await ctx.close();
  }

  // ---------- REVIEW-FIX delta (F1–F4 + nits) ----------
  {
    // F1: selected beyond first 8 rows is visible + underlay aligned
    const { ctx, page } = await open({}, BASE + "?brand=thisisneverthat");
    await page.locator(".cat-filter-desktop summary", { hasText: "Thương hiệu" }).waitFor();
    await sleep(500);
    const f1 = await page.evaluate(() => { const g = document.querySelector(".cat-filter-desktop .cat-brand-body .cat-slide-opts"); const a = g.querySelector("[data-active='true']"); const bg = g.querySelector(".cat-selbg"); return { has: !!a, checked: a?.querySelector("input")?.checked, vis: a ? a.offsetParent !== null : false, op: getComputedStyle(bg).opacity, off: a ? Math.abs(new DOMMatrixReadOnly(getComputedStyle(bg).transform).m42 - a.offsetTop) : 99, rows: g.querySelectorAll(".cat-filter-option").length }; });
    check("F1 brand beyond row 8: active row rendered, checked, underlay aligned", f1.has && f1.checked && f1.vis && f1.op === "1" && f1.off < 1, JSON.stringify(f1));
    await page.screenshot({ path: SHOT("fix-f1-brand-pinned.png"), clip: { x: 0, y: 700, width: 420, height: 900 }, fullPage: true });
    // expanding/collapsing keeps the single indicator aligned (no ghost)
    await page.locator(".cat-filter-desktop .cat-brand-body .cat-brand-more").click(); await sleep(600);
    const f1b = await page.evaluate(() => { const g = document.querySelector(".cat-filter-desktop .cat-brand-body .cat-slide-opts"); const a = g.querySelector("[data-active='true']"); const bg = g.querySelector(".cat-selbg"); return { n: g.querySelectorAll(".cat-selbg").length, off: Math.abs(new DOMMatrixReadOnly(getComputedStyle(bg).transform).m42 - a.offsetTop) }; });
    check("F1 expand keeps underlay aligned, single indicator", f1b.n === 1 && f1b.off < 1, JSON.stringify(f1b));
    await ctx.close();
    const cats = await (await fetch(base + "/api/catalog/categories")).json().catch(() => null);
    const list = cats?.result ?? cats?.data ?? null;
    const catId = Array.isArray(list) && list.length > 9 ? list[list.length - 1].id ?? list[list.length - 1].categoryId : null;
    if (catId) {
      const { ctx: c2, page: p2 } = await open({}, BASE + "?categoryId=" + catId);
      await sleep(500);
      const f1c = await p2.evaluate(() => { const g = document.querySelector(".cat-filter-desktop fieldset .cat-slide-opts"); const a = g.querySelector("[data-active='true']"); const bg = g.querySelector(".cat-selbg"); return { has: !!a, op: getComputedStyle(bg).opacity, off: a ? Math.abs(new DOMMatrixReadOnly(getComputedStyle(bg).transform).m42 - a.offsetTop) : 99 }; });
      check("F1 last category (deep link) visible with underlay", f1c.has && f1c.op === "1" && f1c.off < 1, JSON.stringify(f1c));
      await c2.close();
    } else check("F1 last category (deep link) visible with underlay", false, "categories API shape unknown");
  }
  {
    // F2: no failure note / no shift while extent is pending
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    await page.route("**/api/catalog/products*", async (route) => { const u = route.request().url(); if (u.includes("size=1&") || u.endsWith("size=1") || /size=1(&|$)/.test(u)) await sleep(2000); route.continue(); });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#desktop-keyword");
    await sleep(700);
    const pending = await page.evaluate(() => ({ note: !!document.querySelector(".cat-filter-desktop .cat-price-instrument .cat-filter-note"), skel: !!document.querySelector(".cat-filter-desktop .cat-price-skel"), y: document.querySelector("#desktop-keyword").getBoundingClientRect().y, inst: document.querySelector(".cat-filter-desktop .cat-price-instrument").getBoundingClientRect().height }));
    await page.screenshot({ path: SHOT("fix-f2-extent-pending.png"), clip: { x: 0, y: 650, width: 420, height: 450 } });
    await sleep(2600);
    const ready = await page.evaluate(() => ({ track: !!document.querySelector(".cat-filter-desktop .cat-price-track"), y: document.querySelector("#desktop-keyword").getBoundingClientRect().y, inst: document.querySelector(".cat-filter-desktop .cat-price-instrument").getBoundingClientRect().height }));
    check("F2 pending: skeleton, no failure note", pending.skel && !pending.note, JSON.stringify(pending));
    check("F2 rail does not shift when slider arrives", ready.track && Math.abs(ready.y - pending.y) < 1 && Math.abs(ready.inst - pending.inst) < 1, `y ${pending.y}->${ready.y}, h ${pending.inst}->${ready.inst}`);
    check("F2 placeholders formatted like scale", /₫/.test(await page.locator("#desktop-price-min").getAttribute("placeholder")));
    // PageUp on thumb
    await page.locator(".cat-filter-desktop .cat-price-thumb").first().focus();
    await page.keyboard.press("PageUp"); await sleep(700);
    const mp = Number(q(page.url()).get("minPrice"));
    check("F2 PageUp on thumb moves by 10 steps", mp >= 500000, `minPrice=${mp}`);
    await ctx.close();
  }
  {
    // F3: slow page change keeps readout/input consistent + explicit status
    const { ctx, page } = await open();
    await page.route("**/api/catalog/products*", async (route) => { if (/page=1(&|$)/.test(route.request().url()) && /size=6/.test(route.request().url())) await sleep(2000); route.continue(); });
    await page.locator('button[aria-label="Trang sau"]').click(); await sleep(600);
    const during = await page.evaluate(() => ({ status: document.querySelector(".cat-result-count").textContent, input: document.querySelector("#listing-jump").value, role: document.querySelector(".cat-result-count").getAttribute("role") }));
    check("F3 during slow change: readout shows old range + 'Đang cập nhật', input shows displayed page", /^1–6 trên/.test(during.status) && /Đang cập nhật/.test(during.status) && during.input === "1" && during.role === "status", JSON.stringify(during));
    await sleep(2200);
    const after = await page.evaluate(() => ({ status: document.querySelector(".cat-result-count").textContent, input: document.querySelector("#listing-jump").value }));
    check("F3 after load: 7–12 and page 2, no updating text", /^7–12 trên/.test(after.status) && !/Đang cập nhật/.test(after.status) && after.input === "2", JSON.stringify(after));
    await ctx.close();
  }
  {
    // F4: history for debounced keyword
    const { ctx, page } = await open();
    await page.locator(".cat-filter-desktop fieldset .cat-filter-option").nth(2).click(); await sleep(800);
    const withCat = page.url();
    const kw = page.locator("#desktop-keyword");
    await kw.click(); await kw.pressSequentially("shirt", { delay: 80 }); await sleep(1100);
    await kw.pressSequentially(" black", { delay: 80 }); await sleep(1100);
    check("F4 typing session committed keyword", q(page.url()).get("keyword") === "shirt black", page.url());
    await page.goBack(); await sleep(900);
    check("F4 one Back returns to pre-typing filter state (category kept, no keyword)", page.url() === withCat && (await kw.inputValue()) === "", page.url());
    await ctx.close();
  }

  // ---------- Mobile ----------
  {
    const { ctx, page } = await open({ viewport: { width: 390, height: 844 } });
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("M no horizontal overflow at 390", ov <= 0, `${ov}`);
    await page.locator(".cat-filter-mobile > summary").click(); await sleep(400);
    await page.screenshot({ path: SHOT("mobile-filters-open.png"), fullPage: true });
    const clipped = await page.evaluate(() => [...document.querySelectorAll(".cat-filter-mobile .cat-input, .cat-filter-mobile .cat-filter-option")].filter((e) => { const r = e.getBoundingClientRect(); return r.right > window.innerWidth + 1 || r.left < -1; }).length);
    check("M filter controls inside viewport", clipped === 0, `${clipped}`);
    await page.locator(".cat-filter-mobile #mobile-keyword").fill("vans"); await sleep(900);
    check("M live search works in mobile panel", q(page.url()).get("keyword") === "vans");
    await page.locator(".cat-filter-mobile .cat-filter-option").nth(2).click(); await sleep(900);
    const m = await page.evaluate(() => { const g = document.querySelector(".cat-filter-mobile fieldset .cat-slide-opts"); const a = g.querySelector("[data-active='true']"); const bg = g.querySelector(".cat-selbg"); return Math.abs(new DOMMatrixReadOnly(getComputedStyle(bg).transform).m42 - a.offsetTop); });
    check("M underlay aligned inside opened mobile panel", m < 1, `${m}`);
    await page.locator(".cat-filter-mobile .cat-filter-reset").click(); await sleep(600);
    await page.locator(".cat-pagination").scrollIntoViewIfNeeded();
    const pg = await rect(page, ".cat-pagination");
    check("M pager fits viewport, target ≥ 44px", pg.r <= 390 && (await rect(page, ".cat-page-btn")).h >= 44);
    await page.screenshot({ path: SHOT("mobile-pager.png") });
    await ctx.close();
  }

}
