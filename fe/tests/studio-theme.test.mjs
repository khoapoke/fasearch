// Run: node --test tests/studio-theme.test.mjs (from fe/)
//
// Chặn hồi quy cho lớp theme search-studio (P1): lựa chọn thiết bị, script boot
// không flash, và việc ba bề mặt pilot thực sự dùng theme + control giao diện.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  THEME_CHOICE_LABELS,
  THEME_CHOICES,
  THEME_STORAGE_KEY,
  normalizeThemeChoice,
  readStoredTheme,
  resolveTheme,
  themeBootScript,
  writeStoredTheme,
} from "../src/lib/theme.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FE_ROOT = resolve(HERE, "..");
const read = (rel) => readFileSync(join(FE_ROOT, rel), "utf8");

describe("lựa chọn giao diện của thiết bị", () => {
  it("mặc định là 'system' (theo hệ điều hành)", () => {
    assert.equal(normalizeThemeChoice(undefined), "system");
    assert.equal(normalizeThemeChoice(null), "system");
    assert.equal(normalizeThemeChoice(""), "system");
    assert.equal(normalizeThemeChoice("neon"), "system");
    assert.equal(readStoredTheme(null), "system");
  });

  it("giữ lựa chọn hợp lệ", () => {
    assert.equal(normalizeThemeChoice("light"), "light");
    assert.equal(normalizeThemeChoice("dark"), "dark");
    assert.equal(normalizeThemeChoice("system"), "system");
  });

  it("đọc lựa chọn đã lưu; storage bị chặn thì không ném", () => {
    const store = { getItem: () => "dark" };
    assert.equal(readStoredTheme(store), "dark");
    const blocked = {
      getItem() {
        throw new Error("blocked");
      },
    };
    assert.equal(readStoredTheme(blocked), "system");
  });

  it("ghi lựa chọn; storage bị chặn thì trả false", () => {
    const seen = [];
    assert.equal(writeStoredTheme("dark", { setItem: (k, v) => seen.push([k, v]) }), true);
    assert.deepEqual(seen, [[THEME_STORAGE_KEY, "dark"]]);
    assert.equal(writeStoredTheme("light", {
      setItem() {
        throw new Error("blocked");
      },
    }), false);
  });

  it("theme hiệu dụng theo lựa chọn + trạng thái OS", () => {
    assert.equal(resolveTheme("light", true), "light");
    assert.equal(resolveTheme("dark", false), "dark");
    assert.equal(resolveTheme("system", true), "dark");
    assert.equal(resolveTheme("system", false), "light");
  });

  it("đủ ba lựa chọn và nhãn tiếng Việt", () => {
    assert.deepEqual(THEME_CHOICES, ["system", "light", "dark"]);
    assert.equal(THEME_CHOICE_LABELS.system, "Theo thiết bị");
    assert.equal(THEME_CHOICE_LABELS.light, "Sáng");
    assert.equal(THEME_CHOICE_LABELS.dark, "Tối");
  });
});

describe("script boot (không flash sai màu)", () => {
  it("đọc localStorage + OS rồi đặt data-theme trước khi vẽ", () => {
    const js = themeBootScript();
    assert.ok(js.includes(THEME_STORAGE_KEY), "phải đọc khoá lưu lựa chọn");
    assert.ok(js.includes('setAttribute("data-theme"'), "phải đặt data-theme");
    assert.ok(js.includes('setAttribute("data-theme-choice"'), "phải giữ lựa chọn của người dùng");
    assert.ok(js.includes("prefers-color-scheme: dark"), "mặc định phải theo hệ điều hành");
    assert.ok(js.includes("try{"), "lỗi storage/matchMedia không được làm hỏng trang");
  });

  it("không nhúng mật khẩu hay dữ liệu nhạy cảm", () => {
    const js = themeBootScript();
    assert.doesNotMatch(js, /password|token|secret/i);
  });
});

describe("bề mặt pilot dùng theme search-studio", () => {
  it("layout chèn script boot trong <head> và nạp studio.css", () => {
    const layout = read("src/app/layout.tsx");
    assert.match(layout, /<head>/, "script boot phải nằm trong <head> để chạy trước lần vẽ đầu");
    assert.match(layout, /themeBootScript\(\)/);
    assert.match(layout, /studio\.css/);
  });

  it("ba pilot bật scope studio", () => {
    const ai = read("src/app/tim-kiem-ai/search-view.tsx");
    const listing = read("src/app/nam/catalog-listing.tsx");
    const detail = read("src/app/san-pham/[id]/page.tsx");
    const pos = read("src/app/kenh-ban/pos/page.tsx");
    assert.match(ai, /<StorefrontShell[\s\S]*?themed/, "pilot AI phải bật theme");
    assert.match(detail, /<StorefrontShell[^>]*themed/, "pilot chi tiết sản phẩm phải bật theme");
    assert.match(pos, /<MerchantShell[\s\S]*?themed/, "pilot POS phải bật theme");
    assert.match(listing, /<StorefrontShell[^>]*themed/, "pilot danh sách /nam phải bật theme");
  });

  it("vỏ bán hàng và kênh bán có chỗ đặt control giao diện", () => {
    assert.match(read("src/components/storefront/storefront-shell.tsx"), /ThemeControl/);
    assert.match(read("src/components/merchant/merchant-shell.tsx"), /ThemeControl/);
  });

  it("control giao diện có nhãn tiếng Việt và ba lựa chọn", () => {
    const control = read("src/components/studio/theme-control.tsx");
    assert.match(control, /aria-label="Giao diện"/);
    assert.match(control, /THEME_CHOICES/);
    assert.match(control, /localStorage/);
  });

  it("bảng màu pilot khớp DESIGN §2 (Ultramarine + Citron + hai theme)", () => {
    const css = read("src/components/studio/studio.css");
    for (const token of ["#3730d8", "#d6ef72", "#f6f7fc", "#11131c", "#1a1d2b", "#b4afff"]) {
      assert.ok(css.includes(token), `thiếu token màu ${token}`);
    }
    assert.match(css, /html\[data-theme="dark"\]/, "phải có nhánh theme tối theo lựa chọn");
    assert.match(css, /@media \(prefers-color-scheme: dark\)/, "phải có nhánh theo hệ điều hành");
  });

  it("bề mặt pilot không còn nền trắng hardcode (tránh hản trắng ở theme tối)", () => {
    const files = [
      "src/components/storefront/listing.css",
      "src/components/storefront/storefront.css",
      "src/components/merchant/merchant.css",
      "src/app/san-pham/[id]/detail.css",
      "src/components/mgmt/mgmt.module.css",
      "src/components/account/account.module.css",
    ];
    for (const f of files) {
      const css = read(f);
      assert.doesNotMatch(css, /background:\s*#fff\s*;/, `${f}: nền trắng hardcode phải chuyển sang token`);
    }
  });

  it("bộ lọc danh sách thu gọn được trên điện thoại", () => {
    const listing = read("src/components/storefront/listing-page.tsx");
    assert.match(listing, /stFiltersToggle/, "phải có nút mở bộ lọc trên điện thoại");
    assert.match(listing, /aria-expanded=\{filtersOpen\}/);
    assert.match(listing, /stFiltersSummary/, "phải hiện tóm tắt bộ lọc đang áp dụng");
  });
});
