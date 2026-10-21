// Nguồn thông tin đăng nhập fixture — KHÔNG chứa bí mật trong mã theo dõi.
//
// Mật khẩu fixture nằm ở tệp KHÔNG theo dõi git (mặc định `fe/.local/fixtures.json`,
// hoặc đường dẫn trong biến môi trường `FE_FIXTURE_CONFIG`). Tệp được bỏ qua bởi
// .gitignore; khi thiếu, hàm ném lỗi nói rõ cần tạo tệp ở đâu — không có giá trị
// mặc định và không in giá trị bí mật ra log.
//
// Dạng tệp:
// { "accounts": { "customer": { "username": "...", "password": "..." }, ... } }
// Vai trò dùng: customer | staff | admin.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE_ROOT = resolve(HERE, "..");
export const DEFAULT_FIXTURE_CONFIG = join(FE_ROOT, ".local", "fixtures.json");
export const FIXTURE_CONFIG_ENV = "FE_FIXTURE_CONFIG";

export function fixtureConfigPath() {
  return process.env[FIXTURE_CONFIG_ENV]
    ? resolve(process.env[FIXTURE_CONFIG_ENV])
    : DEFAULT_FIXTURE_CONFIG;
}

export function loadFixtureConfig() {
  const path = fixtureConfigPath();
  if (!existsSync(path)) {
    throw new Error(
      `Thiếu cấu hình fixture đăng nhập.\n`
      + `  Cần tệp: ${path}\n`
      + `  hoặc đặt biến môi trường ${FIXTURE_CONFIG_ENV}=<đường dẫn tệp>\n`
      + `  Dạng tệp: { "accounts": { "customer": { "username": "...", "password": "..." }, `
      + `"staff": { ... }, "admin": { ... } } }\n`
      + `  Tệp này KHÔNG được commit (đã nằm trong .gitignore).`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`Không đọc được cấu hình fixture tại ${path}: ${e.message}`);
  }
  const accounts = parsed?.accounts;
  if (!accounts || typeof accounts !== "object") {
    throw new Error(`Cấu hình fixture tại ${path} thiếu khối "accounts".`);
  }
  for (const [role, acc] of Object.entries(accounts)) {
    if (!acc || typeof acc.username !== "string" || typeof acc.password !== "string") {
      throw new Error(
        `Cấu hình fixture tại ${path}: vai trò "${role}" cần "username" và "password" dạng chuỗi.`,
      );
    }
  }
  return { path, accounts };
}

/**
 * Lấy đúng một alias; nếu thiếu thì nêu rõ phải bổ sung gì.
 * Dùng cho các vai trò cần DANH TÍNH RIÊNG (ví dụ customerA/customerB là hai khách
 * thật khác nhau) — không có giá trị mặc định, không in mật khẩu.
 */
export function requireAccount(config, alias) {
  const acc = config?.accounts?.[alias];
  if (!acc || typeof acc.username !== "string" || typeof acc.password !== "string") {
    throw new Error(
      `Thiếu alias fixture "${alias}" trong ${config?.path ?? fixtureConfigPath()}.\n`
      + `  Cần tài khoản riêng cho alias này: { "accounts": { "${alias}": { "username": "...", "password": "..." } } }\n`
      + `  Chạy: node scripts/provision-fixture-config.mjs`
      + ` (đọc runtime/reliability-credentials.env; tệp đích KHÔNG theo dõi git)\n`
      + `  Không có giá trị mặc định và không in mật khẩu ra log.`,
    );
  }
  return acc;
}

/** Tóm tắt an toàn để log: chỉ tên đăng nhập, không có mật khẩu. */
export function describeFixtureConfig(config) {
  const roles = Object.keys(config.accounts).sort().join(", ");
  return `fixture config ${config.path} (roles: ${roles}; mật khẩu không hiển thị)`;
}
