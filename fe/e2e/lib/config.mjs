// Central, env-driven configuration for the FaSearch e2e suite. Nothing here reads secrets.
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const env = process.env;
const list = (v, d) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : d);

export const BASELINE_DB = "fasearch_admin_customer_core_20261104";
export const ALL_GROUPS = ["customer", "admin", "roles", "ai", "payments"];

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const defaultRunDir = path.join(env.E2E_REPORT_DIR || path.join(os.tmpdir(), "fasearch-e2e"), stamp);

export const cfg = {
  baseUrl: (env.E2E_BASE_URL || "").replace(/\/+$/, ""),
  apiUrl: (env.E2E_API_URL || "").replace(/\/+$/, ""),
  mode: env.E2E_MODE === "write" ? "write" : "readonly",
  allowWrites: env.E2E_ALLOW_WRITES === "1",
  dbIsClone: env.E2E_DB_IS_CLONE === "1",
  dbName: env.E2E_DB_NAME || "",
  groups: list(env.E2E_GROUPS, ALL_GROUPS),
  fixturesDir: env.E2E_FIXTURES_DIR || "",
  rolesMatrix: env.E2E_ROLES_MATRIX || "",
  // Ports that must never be written to (baseline FE / BE / AI by default).
  protectedPorts: list(env.E2E_BASELINE_PORTS, ["3191", "18164", "8024"]),
  browsersPath: env.E2E_BROWSERS_PATH || env.PLAYWRIGHT_BROWSERS_PATH || "",
  runDir: env.E2E_RUN_DIR || defaultRunDir,
  // Optional explicit data overrides (otherwise discovered at runtime).
  productId: env.E2E_PRODUCT_ID ? Number(env.E2E_PRODUCT_ID) : null,
  skuIds: list(env.E2E_SKU_IDS, []).map(Number),
  keepShots: env.E2E_KEEP_SCREENSHOTS === "1",
};

export function portOf(url) {
  try { const u = new URL(url); return u.port || (u.protocol === "https:" ? "443" : "80"); } catch { return ""; }
}

/** Throws unless every write guard holds. Called by run.mjs and again by every write suite. */
export function assertWriteAllowed() {
  const why = [];
  if (cfg.mode !== "write") why.push("E2E_MODE is not 'write'");
  if (!cfg.allowWrites) why.push("E2E_ALLOW_WRITES=1 missing");
  if (!cfg.dbIsClone) why.push("E2E_DB_IS_CLONE=1 missing");
  if (!cfg.dbName) why.push("E2E_DB_NAME missing (name of the BE database you are pointing at)");
  if (cfg.dbName === BASELINE_DB) why.push("E2E_DB_NAME is the baseline DB");
  if (cfg.dbName && !/^fasearch_(cand|it|e2e|clone)[a-z0-9_]*$/i.test(cfg.dbName)) why.push("E2E_DB_NAME does not look like a clone/candidate DB (fasearch_cand_*, fasearch_it_*, fasearch_e2e_*, fasearch_clone_*)");
  for (const [label, url] of [["E2E_BASE_URL", cfg.baseUrl], ["E2E_API_URL", cfg.apiUrl]]) {
    if (url && cfg.protectedPorts.includes(portOf(url))) why.push(`${label} points at protected baseline port ${portOf(url)}`);
  }
  if (!cfg.baseUrl) why.push("E2E_BASE_URL missing");
  if (why.length) throw new Error("E2E write mode refused: " + why.join("; "));
}

export function writeMode() {
  if (cfg.mode !== "write") return false;
  assertWriteAllowed();
  return true;
}

export function groupSelected(groups) {
  return [].concat(groups).some((g) => cfg.groups.includes(g));
}

export function ensureRunDir() {
  fs.mkdirSync(cfg.runDir, { recursive: true });
  return cfg.runDir;
}

/** E2E_KNOWN_FAILS="substring one,substring two": matching tests run but are reported as TODO (not failures). */
export const knownFails = (process.env.E2E_KNOWN_FAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
export const knownReason = (name) => (knownFails.some((k) => name.includes(k)) ? "known gap declared via E2E_KNOWN_FAILS" : undefined);
