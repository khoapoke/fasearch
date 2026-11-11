// Private fixture loader. Credentials are read from files under E2E_FIXTURES_DIR, kept in memory
// only, and never logged, put in argv/URLs, screenshots or error messages.
//   accounts.json  { accounts: [{ role: "ADMIN"|"CUSTOMER"|"STAFF"|..., username, password }] }
//   customer.json  { username, password }                (optional; preferred for CUSTOMER)
//   staff.json     { username, password }                (optional; only exists on clone DBs)
//   <role>.json    { username, password }                (generic: manager.json for a MANAGER role, ...)
import fs from "node:fs";
import path from "node:path";
import { cfg } from "./config.mjs";

function readJson(name) {
  if (!cfg.fixturesDir) return null;
  const f = path.join(cfg.fixturesDir, name);
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { throw new Error(`fixture ${name} is not valid JSON`); }
}

const norm = (x) => (x && x.username && x.password ? { username: String(x.username), password: String(x.password) } : null);

/** Returns {username,password} for a role, or null when no fixture exists. */
export function credsFor(role) {
  const r = String(role).toUpperCase();
  const direct = norm(readJson(`${r.toLowerCase()}.json`));
  if (direct) return direct;
  const acc = readJson("accounts.json");
  const list = acc?.accounts ?? acc?.users ?? [];
  return norm(list.find((a) => String(a.role).toUpperCase() === r));
}

export function requireCreds(role) {
  const c = credsFor(role);
  if (!c) throw new Error(`no ${role} fixture under E2E_FIXTURES_DIR (set E2E_FIXTURES_DIR; see e2e/README.md)`);
  return c;
}

export function hasCreds(role) { try { return !!credsFor(role); } catch { return false; } }
