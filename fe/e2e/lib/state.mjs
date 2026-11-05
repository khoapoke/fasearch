// Tiny shared state file in the run dir so suites that run later can reuse ids created by write suites.
import fs from "node:fs";
import path from "node:path";
import { ensureRunDir } from "./config.mjs";

const file = () => path.join(ensureRunDir(), "state.json");
export function loadState() { try { return JSON.parse(fs.readFileSync(file(), "utf8")); } catch { return {}; } }
export function saveState(patch) { const s = { ...loadState(), ...patch }; fs.writeFileSync(file(), JSON.stringify(s, null, 1)); return s; }
