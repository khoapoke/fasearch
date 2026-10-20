// Hợp đồng focus thông báo lỗi (A11Y-1).
//
// Nguyên nhân lỗi: node lỗi được render có điều kiện, nên gọi
// `errorRef.current?.focus()` ngay sau `setError(...)` là no-op — React chưa
// commit node, ref còn null, tiêu điểm rơi về BODY. Cách đúng: focus trong
// effect gắn với biến lỗi (chạy sau khi node đã vào DOM).
//
// Repo không có môi trường DOM trong test (chỉ next/react/react-dom, không
// jsdom/testing-library) nên test này kiểm tra quy tắc ở mức cấu trúc source
// cho toàn bộ màn hình có thông báo lỗi: đúng một effect focus theo trạng
// thái lỗi, và không còn lệnh focus() rời rạc nào khác.
//
// Run: node --test tests/error-focus-contract.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Màn hình có node lỗi render có điều kiện (nên phải focus qua effect).
const SCREENS = [
  "src/app/dang-nhap/login-form.tsx",
  "src/app/thanh-toan/page.tsx",
  "src/app/tim-kiem-ai/search-view.tsx",
  "src/app/don-hang/[id]/page.tsx",
  "src/app/tai-khoan/bao-mat/password-form.tsx",
  "src/app/tai-khoan/thong-tin/profile-editor.tsx",
];

// Effect focus đúng hình dạng đã dùng trong repo: `useEffect(() => { if (…) ref.focus(); }, [dep])`.
const EFFECT_FOCUS = /useEffect\(\(\) => \{\s*if \([^)]+\) errorRef\.current\?\.focus\(\);\s*\}, \[(error|state)\]\)/g;

describe("focus thông báo lỗi (A11Y-1)", () => {
  for (const file of SCREENS) {
    it(`${file}: focus lỗi qua effect theo trạng thái lỗi, không focus() rời rạc`, () => {
      const source = readFileSync(join(root, file), "utf8");
      const effectMatches = source.match(EFFECT_FOCUS) ?? [];
      assert.equal(
        effectMatches.length,
        1,
        `${file}: cần đúng 1 effect focus theo trạng thái lỗi (${EFFECT_FOCUS})`,
      );
      const totalFocusCalls = (source.match(/errorRef\.current\?\.focus\(\)/g) ?? []).length;
      assert.equal(
        totalFocusCalls,
        1,
        `${file}: chỉ được focus() trong effect; còn ${totalFocusCalls - 1} lệnh focus() rời rạc sẽ là no-op`,
      );
    });
  }

  it("không còn mẫu focus() ngay sau setError/setState (nguyên nhân gốc)", () => {
    for (const file of SCREENS) {
      const source = readFileSync(join(root, file), "utf8");
      assert.doesNotMatch(
        source,
        /setError\([^;]*\);\s*\n\s*errorRef\.current\?\.focus\(\)/,
        `${file}: còn focus() ngay sau setError — node lỗi chưa kịp render`,
      );
      assert.doesNotMatch(
        source,
        /setState\(\{ kind: "error"[^;]*\);\s*\n\s*errorRef\.current\?\.focus\(\)/,
        `${file}: còn focus() ngay sau setState — node lỗi chưa kịp render`,
      );
    }
  });
});
