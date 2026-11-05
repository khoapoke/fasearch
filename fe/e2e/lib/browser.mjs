// Shared Playwright helpers. playwright-core is the single devDependency; the Chromium headless shell
// is reused from E2E_BROWSERS_PATH (PLAYWRIGHT_BROWSERS_PATH) – no browser download is performed here.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { cfg, ensureRunDir } from "./config.mjs";
import { requireCreds } from "./fixtures.mjs";

export async function launch() {
  // playwright-core reads PLAYWRIGHT_BROWSERS_PATH when it is first imported, so import it lazily.
  if (cfg.browsersPath) process.env.PLAYWRIGHT_BROWSERS_PATH = cfg.browsersPath;
  const { chromium } = await import("playwright-core");
  return chromium.launch({ args: ["--no-sandbox"] });
}

/** Logged-in browser context for a fixture role (cookie attempt + API login + /me role assertion). */
export async function loginContext(browser, role, width = 1440) {
  const base = cfg.baseUrl;
  const c = await browser.newContext({ viewport: { width, height: width <= 480 ? 844 : 900 } });
  const f = requireCreds(role);
  await c.addCookies([{ name: "fasearch-auth-current-3139", value: randomUUID(), url: base }]);
  const r = await c.request.post(base + "/api/customer-auth/login", { headers: { origin: base }, data: { username: f.username, password: f.password } });
  if (r.status() !== 200) { await c.close(); throw new Error(`LOGIN_${role}_HTTP_${r.status()}`); }
  const me = await (await c.request.get(base + "/api/customer-auth/me")).json();
  if (String(me.identity?.role).toUpperCase() !== String(role).toUpperCase()) { await c.close(); throw new Error(`ROLE_MISMATCH_${role}`); }
  const req = async (p, method = "GET", data) => {
    const rr = await c.request.fetch(base + p, { method, headers: { origin: base }, data });
    let j; try { j = await rr.json(); } catch { /* none */ }
    return { http: rr.status(), data: j?.result, message: j?.message, json: j };
  };
  return { c, req };
}

/** Screenshot path factory for a test; the directory is deleted by `finishShots` when everything passed. */
export function shotDir(name) {
  const d = path.join(ensureRunDir(), "screenshots", name);
  fs.mkdirSync(d, { recursive: true });
  return { dir: d, SHOT: (file) => path.join(d, file) };
}
export function finishShots(dir, failed) {
  if (!failed && !cfg.keepShots) fs.rmSync(dir, { recursive: true, force: true });
}

/** Collects check() results from a ported harness; `emit` turns each into a node:test subtest. */
export function collector() {
  const results = [];
  return {
    results,
    check: (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) }); },
  };
}
export async function emit(t, results) {
  const assert = (await import("node:assert/strict")).default;
  for (const r of results) await t.test(r.name, () => { assert.ok(r.ok, `${r.name} ${r.detail}`.trim()); });
}
