import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePublicOffer,
  normalizeOffers,
  offerDiscountLabel,
  offerValidityLabel,
} from "../src/lib/offers.ts";
import { isMotionEnabled, normalizeMotionPreference, readMotionPreference } from "../src/lib/home-motion.ts";

describe("public offers contract", () => {
  it("keeps only offers with the fields the BE contract actually returns", () => {
    const offer = normalizePublicOffer({
      campaignId: 1,
      title: "Ưu đãi chào mừng",
      discountType: "PHAN_TRAM",
      discountValue: 10,
      conditionText: "Áp dụng cho mọi đơn hàng",
      startAt: "2026-11-01T04:26:53",
      endAt: "2026-12-02T04:26:53",
      code: "WELCOME2026",
    });
    assert.ok(offer);
    assert.equal(offer.code, "WELCOME2026");
    // No fabricated min/cap or saved state.
    assert.equal("minOrder" in offer, false);
    assert.equal("maxDiscount" in offer, false);
  });

  it("drops malformed rows instead of inventing values", () => {
    assert.equal(normalizePublicOffer({ campaignId: 2, title: "Thiếu mã", discountValue: 5 }), null);
    assert.equal(normalizePublicOffer({ campaignId: 0, title: "Sai id", code: "X", discountValue: 5 }), null);
    assert.equal(normalizePublicOffer({ campaignId: 3, title: "Thiếu giá trị", code: "Y" }), null);
    assert.equal(normalizePublicOffer(null), null);
    const result = normalizeOffers([{ campaignId: 9, title: "Hợp lệ", code: "OK2026", discountValue: 12.5, discountType: "PHAN_TRAM" }, { bad: true }]);
    assert.equal(result.rawCount, 2);
    assert.equal(result.offers.length, 1);
  });

  it("labels discounts and validity only from returned data", () => {
    const percent = normalizePublicOffer({ campaignId: 1, title: "A", code: "A1", discountType: "PHAN_TRAM", discountValue: 10 });
    const amount = normalizePublicOffer({ campaignId: 2, title: "B", code: "B1", discountType: "SO_TIEN", discountValue: 25000 });
    assert.equal(offerDiscountLabel(percent), "Giảm 10%");
    assert.match(offerDiscountLabel(amount), /25\.000/);
    assert.equal(offerValidityLabel(percent), null);
    assert.match(offerValidityLabel(normalizePublicOffer({ campaignId: 3, title: "C", code: "C1", discountValue: 1, endAt: "2026-12-02T04:26:53" })), /^Đến /);
  });
});

describe("home motion preference", () => {
  it("disables motion when the user turns it off or the device asks for reduced motion", () => {
    assert.equal(isMotionEnabled("auto", false), true);
    assert.equal(isMotionEnabled("auto", true), false);
    assert.equal(isMotionEnabled("off", false), false);
    assert.equal(isMotionEnabled("off", true), false);
  });

  it("normalizes stored values and survives blocked storage", () => {
    assert.equal(normalizeMotionPreference("off"), "off");
    assert.equal(normalizeMotionPreference("on"), "auto");
    assert.equal(normalizeMotionPreference(null), "auto");
    assert.equal(readMotionPreference({ getItem: () => "off" }), "off");
    assert.equal(readMotionPreference({ getItem: () => { throw new Error("blocked"); } }), "auto");
  });
});

// Consolidated from fe/tests/studio-theme.test.mjs; audit 2026-11-07.
{
// Run: node --test tests/home-benefits.test.mjs (from fe/)
//
// Chặn hồi quy cho lớp theme search-studio (P1): lựa chọn thiết bị, script boot
// không flash, và việc ba bề mặt pilot thực sự dùng theme + control giao diện.
const { describe, it } = await import("node:test");
const { default: assert } = await import("node:assert/strict");

const { THEME_CHOICE_LABELS, THEME_CHOICES, THEME_STORAGE_KEY, normalizeThemeChoice, readStoredTheme, resolveTheme, themeBootScript, writeStoredTheme } = await import("../src/lib/theme.ts");

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


}
