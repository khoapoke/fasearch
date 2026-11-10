// [roles] Data-driven role boundary checks. The allow/deny matrix lives in JSON
// (fixtures/roles-matrix.quan-ly.json = ADMIN / Quản lý (STAFF) / CUSTOMER on the role-manager baseline; E2E_ROLES_MATRIX overrides).
// Ported from admin-quality-pass-20261105/live/staff-boundary.mjs, generalised per role.
// Denied-write probes need valid bodies, so they run in write mode (clone DB) only and are skipped in readonly mode.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cfg, writeMode } from "../lib/config.mjs";
import { suite } from "../lib/suite.mjs";
import { launch, loginContext } from "../lib/browser.mjs";
import { hasCreds } from "../lib/fixtures.mjs";
import { Client } from "../lib/http.mjs";
import { step } from "../lib/steps.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const matrixFile = cfg.rolesMatrix || path.join(here, "..", "fixtures", "roles-matrix.quan-ly.json");
const matrix = JSON.parse(fs.readFileSync(matrixFile, "utf8"));
const canWrite = (() => { try { return writeMode(); } catch { return false; } })();

suite("roles", `role boundaries (${path.basename(matrixFile)})`, () => {
  let browser;
  before(async () => { browser = await launch(); });
  after(async () => { await browser?.close(); });

  for (const [role, rule] of Object.entries(matrix.roles)) {
    const fixtureRole = rule.fixtureRole ?? role;
    const has = hasCreds(fixtureRole);
    test(`${role}`, { skip: has ? undefined : `no ${fixtureRole} fixture in E2E_FIXTURES_DIR (clone-only role?)`, timeout: 300000 }, async (t) => {
      const s = await loginContext(browser, fixtureRole, rule.viewport ?? 1440);
      const p = await s.c.newPage(); p.setDefaultTimeout(8000);
      const deny = matrix.denyText;
      try {
        for (const r of rule.deniedRoutes ?? []) await step(t, `${role}: /quan-tri/${r.route} denied`, async () => {
          await p.goto(cfg.baseUrl + "/quan-tri/" + r.route, { waitUntil: "networkidle" });
          const h1 = (await p.locator("main h1").first().innerText().catch(() => "")) || "";
          assert.ok(h1.includes(deny), `denial heading "${deny}" not shown (h1="${h1.slice(0, 60)}")`);
          if (r.action) assert.equal(await p.getByRole("button", { name: r.action, exact: true }).count(), 0, `write control "${r.action}" visible`);
        });
        for (const r of rule.allowedRoutes ?? []) await step(t, `${role}: /quan-tri/${r.route || "(overview)"} allowed`, async () => {
          await p.goto(cfg.baseUrl + "/quan-tri" + (r.route ? "/" + r.route : ""), { waitUntil: "networkidle" });
          const h1 = (await p.locator("main h1").first().innerText().catch(() => "")) || "";
          assert.ok(!h1.includes(deny), "denial heading shown");
          if (r.selector) assert.ok(await p.locator(r.selector).isVisible(), `${r.selector} not visible`);
        });
        if ((rule.sidebarRequired?.length ?? 0) + (rule.sidebarForbidden?.length ?? 0) > 0) await step(t, `${role}: sidebar affordances`, async () => {
          await p.goto(cfg.baseUrl + "/quan-tri", { waitUntil: "networkidle" });
          const links = await p.locator(".sidebar a").evaluateAll((a) => a.map((x) => x.getAttribute("href")));
          for (const h of rule.sidebarForbidden ?? []) assert.ok(!links.includes(h), `forbidden sidebar link ${h}`);
          for (const h of rule.sidebarRequired ?? []) assert.ok(links.includes(h), `missing sidebar link ${h}`);
        });
        if (rule.displayLabel) await step(t, `${role}: display label "${rule.displayLabel}"`, async () => {
          await p.goto(cfg.baseUrl + "/quan-tri", { waitUntil: "networkidle" });
          assert.ok((await p.locator("body").innerText()).includes(rule.displayLabel), "label not shown");
        });
        if (rule.journalHeading) await step(t, `${role}: activity journal shows current permission state`, async () => {
          await p.goto(cfg.baseUrl + "/quan-tri/nhat-ky", { waitUntil: "networkidle" });
          assert.ok((await p.locator("main").innerText()).includes(rule.journalHeading));
          const audit = await s.req("/api/admin/audit?page=0&size=1");
          if (audit.http === 200) {
            await p.getByLabel("Tìm đối tượng").waitFor();
            assert.ok(Array.isArray(audit.data?.content), "audit API must return activity entries");
          } else {
            assert.equal(audit.http, 403);
            await p.getByText("Bạn không có quyền xem nhật ký hoạt động.", { exact: true }).waitFor();
          }
        });
        for (const u of rule.allowedReads ?? []) await step(t, `${role}: GET ${u.split("?")[0]} allowed`, async () => { const r = await s.req(u); assert.equal(r.http, 200, `http ${r.http}`); });
        for (const u of rule.deniedReads ?? []) await step(t, `${role}: GET ${u.split("?")[0]} denied`, async () => { const r = await s.req(u); assert.ok([401, 403].includes(r.http), `http ${r.http}`); });
        for (const w of rule.deniedWrites ?? []) {
          const name = `${role}: POST ${w.path} denied`;
          // Bean validation runs before authorization on these endpoints (an empty body answers 400), so a
          // meaningful probe needs a valid body – which would create data if the rule regressed. Write mode only.
          if (!canWrite) { await t.test(name, { skip: "readonly mode: needs a valid body (would create data on regression)" }, () => {}); continue; }
          await step(t, name, async () => { const r = await s.req(w.path, "POST", w.body); assert.equal(r.http, 403, `http ${r.http} ${r.message ?? ""}`); });
        }
        for (const w of rule.allowedWrites ?? []) {
          const name = `${role}: POST ${w.path} allowed`;
          if (!canWrite) { await t.test(name, { skip: "readonly mode: would create data" }, () => {}); continue; }
          await step(t, name, async () => { const body = JSON.parse(JSON.stringify(w.body).replaceAll("{{rand}}", Math.random().toString(36).slice(2, 8))); const r = await s.req(w.path, "POST", body); assert.ok((w.expect ?? [200, 201]).includes(r.http), `http ${r.http} ${r.message ?? ""}`); });
        }
      } finally { await s.c.close(); }
    });
  }

  test("GUEST cannot reach admin data", async (t) => {
    const g = new Client();
    for (const u of ["/api/admin/overview", "/api/admin/orders", "/api/admin/accounts"]) await step(t, `GUEST: GET ${u} denied`, async () => { const r = await g.req("GET", u); assert.ok([401, 403].includes(r.code), `http ${r.code}`); });
  });
});
