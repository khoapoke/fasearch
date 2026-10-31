// Nạp credential fixture từ tệp runtime của task vào tệp cấu hình KHÔNG theo dõi git.
//
// Tệp nguồn: `runtime/reliability-credentials.env` (mỗi dòng `TEN=MAT_KHAU`, tên tài
// khoản là giá trị trước `=`). Tệp đích: `fe/.local/fixtures.json` (đã nằm trong
// .gitignore). KHÔNG có mật khẩu nào trong mã theo dõi và KHÔNG in mật khẩu ra log.
//
// Dùng: node scripts/provision-fixture-config.mjs [--check]
//   --check  chỉ kiểm tra: tệp nguồn/tệp đích có đủ alias không, không ghi gì.

import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE_ROOT = resolve(HERE, "..");
const CREDENTIALS_ENV = process.env.RELIABILITY_CREDENTIALS_ENV || "runtime/reliability-credentials.env";

/** Tìm tệp credential: ưu tiên biến môi trường, không thì dò lên từ FE_ROOT. */
export function credentialsEnvPath() {
  if (process.env.RELIABILITY_CREDENTIALS_ENV) return resolve(process.env.RELIABILITY_CREDENTIALS_ENV);
  let dir = FE_ROOT;
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(dir, CREDENTIALS_ENV);
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  return resolve(FE_ROOT, "../../..", CREDENTIALS_ENV);
}

/** Đọc `TEN=GIATRI`; bỏ qua dòng trống và dòng chú thích. */
export function parseCredentialsEnv(text) {
  const out = new Map();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i <= 0) continue;
    out.set(trimmed.slice(0, i).trim(), trimmed.slice(i + 1).trim());
  }
  return out;
}

/**
 * Ánh xạ tên tài khoản trong tệp credential -> alias dùng trong harness.
 * Suy ra từ hậu tố tên, không hardcode danh sách tài khoản cụ thể.
 */
export function aliasForAccount(name) {
  if (/-custA$/i.test(name)) return "customerA";
  if (/-custB$/i.test(name)) return "customerB";
  if (/-staff$/i.test(name)) return "staffAlt";
  if (/-admin$/i.test(name)) return "adminAlt";
  return null;
}

/** Tài khoản nào là "khách thuộc về mình" (dùng cho kiểm tra sở hữu). */
export const REQUIRED_ALIASES = ["customerA", "customerB"];

export function collectAliases(records) {
  const accounts = {};
  for (const [name, password] of records) {
    const alias = aliasForAccount(name);
    if (!alias) continue;
    accounts[alias] = { username: name, password };
  }
  return accounts;
}

function readExistingConfig(path) {
  if (!existsSync(path)) return { accounts: {} };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return { accounts: parsed?.accounts && typeof parsed.accounts === "object" ? parsed.accounts : {} };
  } catch {
    return { accounts: {} };
  }
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const src = credentialsEnvPath();
  const dest = join(FE_ROOT, ".local", "fixtures.json");
  if (!existsSync(src)) {
    console.error(
      `Thiếu tệp credential runtime: ${src}\n`
      + `  Cần tệp có các dòng TEN=MAT_KHAU cho fixture của task (ví dụ reliability-custA/custB).\n`
      + `  Đặt biến môi trường RELIABILITY_CREDENTIALS_ENV=<đường dẫn> để trỏ tệp khác.`,
    );
    process.exit(1);
  }
  const records = parseCredentialsEnv(readFileSync(src, "utf8"));
  const found = collectAliases(records);
  const missing = REQUIRED_ALIASES.filter((a) => !found[a]);
  const existing = readExistingConfig(dest);
  const merged = { ...existing.accounts, ...found };
  if (missing.length > 0) {
    console.error(
      `Tệp credential ${src} thiếu alias: ${missing.join(", ")}\n`
      + `  Cần tài khoản thật cho từng vai trò khách (tên tài khoản kết thúc bằng -custA/-custB).`,
    );
    process.exit(1);
  }
  if (checkOnly) {
    console.log(`OK: ${src} có đủ alias ${REQUIRED_ALIASES.join(", ")}; tệp đích ${dest} (chưa ghi)`);
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, `${JSON.stringify({ accounts: merged }, null, 1)}\n`, { mode: 0o600 });
  chmodSync(dest, 0o600);
  // Chỉ in alias + tên đăng nhập, KHÔNG in mật khẩu.
  console.log(
    `Đã cập nhật ${dest} (quyền 600, KHÔNG theo dõi git). Alias: `
    + Object.keys(found).map((a) => `${a}=${found[a].username}`).join(", "),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
