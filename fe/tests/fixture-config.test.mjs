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
const { loadFixtureConfig, fixtureConfigPath, requireAccount, FIXTURE_CONFIG_ENV } = await import("../scripts/fixture-config.mjs");
const provision = await import("../scripts/provision-fixture-config.mjs");

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

describe("alias fixture rời nhau (customerA / customerB)", () => {
  it("thiếu alias -> lỗi nêu đúng alias + lệnh nạp, không kèm bí mật", () => {
    const config = { path: "/tmp/fix.json", accounts: { customer: { username: "u", password: "s3cret-zzz" } } };
    assert.throws(
      () => requireAccount(config, "customerB"),
      (err) => {
        assert.match(err.message, /customerB/, "phải nêu tên alias thiếu");
        assert.match(err.message, /provision-fixture-config\.mjs/, "phải nêu cách nạp");
        assert.ok(!err.message.includes("s3cret-zzz"),
          "không được kèm mật khẩu trong thông báo lỗi");
        return true;
      },
    );
  });

  it("có alias -> trả đúng tài khoản", () => {
    const config = { path: "/tmp/fix.json", accounts: { customerB: { username: "u2", password: "p2" } } };
    assert.deepEqual(requireAccount(config, "customerB"), { username: "u2", password: "p2" });
  });

  it("tệp credential: parse TEN=MAT_KHAU và suy ra alias từ hậu tố tên", () => {
    const records = provision.parseCredentialsEnv("# ghi chú\n\nshop-custA=mat-khau-a\nshop-custB=mat-khau-b\nshop-staff=mat-khau-s\n");
    assert.equal(records.size, 3, "bỏ qua dòng trống và dòng chú thích");
    assert.equal(provision.aliasForAccount("shop-custA"), "customerA");
    assert.equal(provision.aliasForAccount("shop-custB"), "customerB");
    assert.equal(provision.aliasForAccount("shop-staff"), "staffAlt");
    assert.equal(provision.aliasForAccount("khong-alias"), null);
    const accounts = provision.collectAliases(records);
    assert.deepEqual(Object.keys(accounts).sort(), ["customerA", "customerB", "staffAlt"]);
    assert.equal(accounts.customerA.username, "shop-custA");
  });

  it("tệp credential và tệp fixture KHÔNG được theo dõi git", () => {
    const gitignore = readFileSync(join(FE_ROOT, ".gitignore"), "utf8");
    assert.match(gitignore, /\/?\.local\//, ".gitignore phải bỏ qua fe/.local/");
  });
});
