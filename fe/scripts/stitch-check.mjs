// Scoped regression/contract check for fe-stitch-29-delivery.
// Run: BASE_URL=http://127.0.0.1:3101 node scripts/stitch-check.mjs
// Checks: (1) every ROUTE_MAP route responds (guest: 200 or login redirect);
// (2) public catalog envelope still unwraps; (3) no be/** files changed;
// (4) stitch-assets cover all 29 manifest screens.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3101";
let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures += 1;
}

const ROUTES = [
  "/", "/nam", "/nu", "/hang-moi", "/sale", "/bo-suu-tap", "/san-pham/1",
  "/gio-hang", "/thanh-toan", "/don-hang", "/yeu-thich", "/voucher",
  "/lich-su-ai", "/tai-khoan", "/tai-khoan/thong-tin", "/tai-khoan/bao-mat",
  "/tai-khoan/dia-chi", "/kenh-ban", "/kenh-ban/don-hang", "/kenh-ban/nhap-kho",
  "/kenh-ban/bao-cao", "/kenh-ban/voucher", "/kenh-ban/ton-kho", "/kenh-ban/chung-tu", "/kenh-ban/chuyen-kho", "/kenh-ban/kiem-ke", "/kenh-ban/canh-bao", "/kenh-ban/kho", "/quan-tri/danh-muc",
  "/quan-tri/san-pham", "/quan-tri/san-pham/3", "/quan-tri/khach-hang",
  "/quan-tri/tai-khoan", "/quan-tri/nhat-ky", "/he-thong/phan-quyen",
  "/he-thong/sao-luu", "/xem-truoc/phan-quyen-b", "/xem-truoc/tong-quan-cua-hang",
  "/catalog", "/catalog/1", "/dang-nhap", "/dang-ky",
];

for (const route of ROUTES) {
  try {
    const out = execSync(
      `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" --max-time 10 "${BASE}${route}"`,
      { encoding: "utf8" },
    ).trim();
    const code = out.split(" ")[0];
    const ok = code === "200" || code === "307" || code === "308";
    check(`GET ${route}`, ok, `HTTP ${out}`);
  } catch (e) {
    check(`GET ${route}`, false, String(e).slice(0, 120));
  }
}

// Public catalog envelope contract (§6): shape must still unwrap.
try {
  const raw = execSync(`curl -s --max-time 10 "${BASE}/api/be/v1/catalog/danh-muc"`, { encoding: "utf8" });
  const payload = JSON.parse(raw);
  const ok = payload.success === true && Array.isArray(payload.result) && payload.result.length > 0;
  check("catalog envelope", ok, `${payload.result?.length ?? 0} categories`);
} catch (e) {
  check("catalog envelope", false, String(e).slice(0, 120));
}

// Backend untouched: no be/** changes vs base.
try {
  const changed = execSync("git status --porcelain -- be/ ai/ | head -5", { encoding: "utf8" }).trim();
  check("be/** untouched", changed === "", changed || "clean");
} catch (e) {
  check("be/** untouched", false, String(e).slice(0, 120));
}

// Asset coverage: manifest folders ∩ stitch-assets screens.
try {
  const manifest = JSON.parse(readFileSync(new URL("../../.agent/tasks/fe-stitch-29-delivery/screen-manifest.json", import.meta.url)));
  const assets = readFileSync(new URL("../src/lib/stitch-assets.ts", import.meta.url), "utf8");
  const missing = manifest.filter((m) => !assets.includes(m.folder)).map((m) => m.folder);
  check("29-screen asset coverage", missing.length === 0, missing.join(",") || `${manifest.length} screens`);
} catch (e) {
  check("29-screen asset coverage", false, String(e).slice(0, 120));
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
