// FP-1: mật khẩu fixture không được nằm trong mã theo dõi; loader phải báo lỗi
// hành động được khi thiếu cấu hình, không có giá trị mặc định và không log bí mật.
//
// Run: node --test tests/fixture-config.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(FE_ROOT, "..");
const { loadFixtureConfig, fixtureConfigPath, FIXTURE_CONFIG_ENV } = await import("../scripts/fixture-config.mjs");

function withConfig(config, fn) {
  const dir = mkdtempSync(join(tmpdir(), "fixture-config-"));
  const path = join(dir, "fixtures.json");
  writeFileSync(path, JSON.stringify(config));
  const previous = process.env[FIXTURE_CONFIG_ENV];
  process.env[FIXTURE_CONFIG_ENV] = path;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env[FIXTURE_CONFIG_ENV];
    else process.env[FIXTURE_CONFIG_ENV] = previous;
  }
}

describe("fixture config loader (FP-1)", () => {
  it("thiếu tệp -> lỗi nói rõ đường dẫn + biến môi trường, không kèm bí mật", () => {
    const previous = process.env[FIXTURE_CONFIG_ENV];
    process.env[FIXTURE_CONFIG_ENV] = join(tmpdir(), "khong-ton-tai-fixtures.json");
    try {
      assert.throws(() => loadFixtureConfig(), (e) => {
        assert.match(e.message, /Thiếu cấu hình fixture/);
        assert.match(e.message, /FE_FIXTURE_CONFIG/);
        assert.doesNotMatch(e.message, /password"?\s*[:=]\s*"?[A-Za-z0-9]{6,}/);
        return true;
      });
    } finally {
      if (previous === undefined) delete process.env[FIXTURE_CONFIG_ENV];
      else process.env[FIXTURE_CONFIG_ENV] = previous;
    }
  });

  it("tệp hỏng / thiếu khối accounts -> lỗi mô tả đúng", () => {
    withConfig({ nope: true }, () => {
      assert.throws(() => loadFixtureConfig(), /accounts/);
    });
    withConfig({ accounts: { customer: { username: "u" } } }, () => {
      assert.throws(() => loadFixtureConfig(), /username/);
    });
  });

  it("tệp hợp lệ -> trả accounts, không log giá trị bí mật", () => {
    withConfig({ accounts: { customer: { username: "u1", password: "p1" } } }, () => {
      const cfg = loadFixtureConfig();
      assert.equal(cfg.accounts.customer.username, "u1");
      assert.equal(cfg.accounts.customer.password, "p1");
    });
  });

  it("đường dẫn mặc định nằm trong fe/.local (bị .gitignore)", () => {
    assert.match(fixtureConfigPath(), /\.local[\\/]fixtures\.json$/);
    const ignored = readFileSync(join(FE_ROOT, ".gitignore"), "utf8");
    assert.match(ignored, /^\/\.local\/$/m);
  });

  it("không mã theo dõi nào chứa mật khẩu fixture dạng chữ", () => {
    const secret = /\b(Adm|Stf|Cst)-\d{8}\b|\bDemo-[A-Za-z]+-\d{4}\b/;
    const scanDirs = [join(REPO_ROOT, ".agent"), join(FE_ROOT, "src"), join(FE_ROOT, "scripts"), join(FE_ROOT, "tests")];
    const hits = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        if (!/\.(md|mjs|ts|tsx|json|sql)$/.test(entry)) continue;
        if (secret.test(readFileSync(full, "utf8"))) hits.push(full);
      }
    };
    for (const dir of scanDirs) walk(dir);
    assert.deepEqual(hits, [], `còn mật khẩu fixture trong: ${hits.join(", ")}`);
  });
});
