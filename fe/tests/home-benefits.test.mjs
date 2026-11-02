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
