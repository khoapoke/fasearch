// node:test custom reporter: writes summary.json + summary.txt into the run dir (no console output).
import fs from "node:fs";
import path from "node:path";

export default async function* reporter(source) {
  const rows = [];
  let t0 = Date.now();
  for await (const ev of source) {
    if (ev.type === "test:pass" || ev.type === "test:fail") {
      const d = ev.data;
      if (d.details?.type === "suite") continue;
      const skipped = d.skip !== undefined || d.todo !== undefined;
      const row = ({ name: d.name, file: d.file ? path.basename(d.file) : "", nesting: d.nesting, status: ev.type === "test:fail" ? (d.todo !== undefined ? "todo" : "fail") : d.todo !== undefined ? "todo" : skipped ? "skip" : "pass", ms: Math.round(d.details?.duration_ms ?? 0), skip: typeof d.skip === "string" ? d.skip : undefined, error: ev.type === "test:fail" ? String(d.details?.error?.cause?.message ?? d.details?.error?.message ?? "").slice(0, 500) : undefined });
      for (let j = rows.length - 1; j >= 0 && rows[j].nesting > row.nesting; j--) if (rows[j].nesting === row.nesting + 1) row.parent = true;
      rows.push(row);
    }
  }
  const dir = process.env.E2E_RUN_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  const leaves = rows.filter((r) => !r.parent);
  const count = (s) => leaves.filter((r) => r.status === s).length;
  const summary = { finishedAt: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), mode: process.env.E2E_MODE || "readonly", base: process.env.E2E_BASE_URL, groups: process.env.E2E_GROUPS || "all", pass: count("pass"), fail: count("fail"), skip: count("skip"), todo: count("todo"), total: leaves.length };
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify({ summary, results: leaves }, null, 1));
  const txt = [`FaSearch e2e  mode=${summary.mode}  base=${summary.base}  groups=${summary.groups}`, `pass=${summary.pass} fail=${summary.fail} todo=${summary.todo} skip=${summary.skip} total=${summary.total}  (leaf tests; suites/parents excluded)`, "", ...leaves.filter((r) => r.status !== "pass").map((r) => `${r.status.toUpperCase().padEnd(5)} ${r.file} :: ${r.name}${r.skip ? "  (" + r.skip + ")" : ""}${r.error ? "\n        " + r.error.replace(/\n/g, "\n        ") : ""}`)];
  fs.writeFileSync(path.join(dir, "summary.txt"), txt.join("\n") + "\n");
}
