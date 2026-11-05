#!/usr/bin/env node
// Single entry for `npm run e2e`: validates env + write guards, runs the selected suites with node --test,
// and writes summary.json / summary.txt into the run dir (outside Git by default).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cfg, assertWriteAllowed, ALL_GROUPS, ensureRunDir } from "./lib/config.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const die = (m) => { console.error("e2e: " + m); process.exit(2); };

if (!cfg.baseUrl) die("E2E_BASE_URL is required (e.g. http://127.0.0.1:3191)");
for (const g of cfg.groups) if (!ALL_GROUPS.includes(g)) die(`unknown group "${g}" (known: ${ALL_GROUPS.join(", ")})`);
if (!cfg.fixturesDir && cfg.groups.some((g) => ["customer", "admin", "roles"].includes(g))) die("E2E_FIXTURES_DIR is required for customer/admin/roles groups (see e2e/README.md)");
if (cfg.mode === "write") { try { assertWriteAllowed(); } catch (e) { die(e.message); } }
const runDir = ensureRunDir();
const filter = process.argv.slice(2);
const files = fs.readdirSync(path.join(here, "tests")).filter((f) => f.endsWith(".test.mjs") && !f.startsWith(".") && (!filter.length || filter.some((x) => f.includes(x)))).sort().map((f) => path.join(here, "tests", f));
if (!files.length) die("no test files match " + filter.join(","));

console.log(`e2e: mode=${cfg.mode} base=${cfg.baseUrl}${cfg.apiUrl ? " api=" + cfg.apiUrl : ""} groups=${cfg.groups.join(",")} runDir=${runDir}`);
const child = spawn(process.execPath, ["--test", "--test-concurrency=1", "--test-reporter=spec", "--test-reporter-destination=stdout", `--test-reporter=${path.join(here, "lib", "reporter.mjs")}`, `--test-reporter-destination=${path.join(runDir, ".reporter")}`, ...files], { stdio: "inherit", env: { ...process.env, E2E_RUN_DIR: runDir } });
child.on("exit", (code) => {
  const f = path.join(runDir, "summary.txt");
  if (fs.existsSync(f)) console.log("\n" + fs.readFileSync(f, "utf8").split("\n").slice(0, 40).join("\n") + `\nreport: ${runDir}`);
  process.exit(code ?? 1);
});
