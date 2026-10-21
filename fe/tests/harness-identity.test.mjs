// Chặn tái nhập lỗi danh tính của R3: hai browser phải là HAI khách thật khác nhau.
//
// Vòng review phát hiện `reliability-journey.mjs` đăng nhập "customer" ở CẢ context A
// và context B -> cùng một tài khoản, nên mọi kết luận "khách A không đọc được của
// khách B" là sai. Các test dưới đây khóa lại đúng điều đó ở mức mã nguồn.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE_ROOT = resolve(HERE, "..");
const harness = readFileSync(join(FE_ROOT, "scripts", "reliability-journey.mjs"), "utf8");

function section(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  assert.notEqual(start, -1, `không tìm thấy ${startMarker}`);
  const end = text.indexOf(endMarker, start);
  assert.notEqual(end, -1, `không tìm thấy ${endMarker}`);
  return text.slice(start, end);
}

const r3 = section(harness, "// ---------- R3: ma trận bảo mật ----------", "// ---------- R4:");

describe("harness R3: hai danh tính thật", () => {
  it("context A và context B dùng HAI alias khác nhau", () => {
    const aliases = [...r3.matchAll(/\.login\("([A-Za-z0-9]+)"\)/g)].map((m) => m[1]);
    assert.deepEqual(
      aliases.slice().sort(),
      ["admin", "customer", "customerA", "customerB", "staff"],
      `các alias trong R3: ${aliases.join(", ")}`,
    );
    // Không được có hai context cùng đăng nhập một alias khách.
    const customerAliases = aliases.filter((a) => a.startsWith("customer"));
    assert.equal(new Set(customerAliases).size, customerAliases.length,
      `alias khách bị trùng trong R3: ${customerAliases.join(", ")}`);
  });

  it("R3 khẳng định /api/auth/me của A và B khác id, và của chủ đơn là id thứ ba", () => {
    assert.match(r3, /HAI danh tính khác nhau/, "thiếu khẳng định hai danh tính khác nhau");
    assert.match(r3, /danh tính thứ ba/, "thiếu khẳng định danh tính chủ đơn khác A/B");
    assert.match(r3, /\/api\/auth\/me/, "thiếu kiểm tra /api/auth/me theo phiên");
  });

  it("R3 có đủ các mảnh kiểm tra sở hữu và cách ly danh sách", () => {
    for (const needle of [
      "khách ngoại không đọc được đơn của khách khác",   // foreign deny
      "chủ đơn đọc được đơn của chính mình",             // owner allow
      "không chứa đơn của khách khác",                   // list isolation
      "không giao nhau",                                  // list isolation A ∩ B
      "0 hiệu ứng",                                      // CSRF không tạo đơn
    ]) {
      assert.ok(r3.includes(needle), `thiếu kiểm tra: ${needle}`);
    }
  });

  it("harness dùng requireAccount nên thiếu alias sẽ báo lỗi hành động được", () => {
    assert.match(harness, /requireAccount\(FIXTURES, role\)/,
      "login() phải gọi requireAccount thay vì đọc thẳng ACCOUNTS[role]");
    assert.match(harness, /import \{ loadFixtureConfig, requireAccount \}/);
  });

  it("mã nguồn harness không chứa mật khẩu dạng chữ", () => {
    assert.doesNotMatch(harness, /\b(Adm|Stf|Cst)-\d{8}\b/);
    assert.doesNotMatch(harness, /\bDemo-[A-Za-z]+-\d{4}\b/);
  });
});
