// R5: kiểm thử biên cho logic chọn biến thể trung thực.
// Run: node --test tests/variant-select.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { axisLabel, isColorValue, isPlaceholder, isSizeValue, resolveSelection } from "../src/lib/variant-select.ts";

const V = (skuId, color, size, additionalPrice = 0) => ({
  skuId,
  productId: 1,
  color,
  size,
  additionalPrice,
});

describe("isPlaceholder", () => {
  it("flags provider sentinels, keeps real values", () => {
    assert.equal(isPlaceholder(null), true);
    assert.equal(isPlaceholder(""), true);
    assert.equal(isPlaceholder("Default Title"), true);
    assert.equal(isPlaceholder("Không xác định"), true);
    assert.equal(isPlaceholder("unknown"), true);
    assert.equal(isPlaceholder("Đen"), false);
    assert.equal(isPlaceholder("M"), false);
    assert.equal(isPlaceholder("Dù"), false);
  });
});

describe("resolveSelection", () => {
  it("3124: single sentinel-only SKU auto-resolves, no choice forced", () => {
    const r = resolveSelection([V(16094, "Default Title", "Không xác định")], "", "");
    assert.equal(r.colors.length, 0);
    assert.equal(r.sizes.length, 0);
    assert.equal(r.selected?.skuId, 16094);
    assert.equal(r.needColor, false);
    assert.equal(r.needSize, false);
    assert.equal(r.ambiguous, false);
  });

  it("multiple all-sentinel SKUs: never guesses, reports ambiguous", () => {
    const r = resolveSelection(
      [
        V(1, "Default Title", "Không xác định"),
        V(2, "Default Title", "Không xác định"),
        V(3, "Default Title", "Không xác định"),
      ],
      "",
      "",
    );
    assert.equal(r.selected, undefined);
    assert.equal(r.candidates.length, 3);
    assert.equal(r.ambiguous, true);
    assert.equal(r.needColor, false);
    assert.equal(r.needSize, false);
  });

  it("2193: multi-size, no color dimension — requires a real size choice", () => {
    const r = resolveSelection([V(1, null, "35"), V(2, null, "36"), V(3, null, "37")], "", "");
    assert.equal(r.colors.length, 0);
    assert.equal(r.selected, undefined);
    assert.equal(r.needSize, true);
    const picked = resolveSelection([V(1, null, "35"), V(2, null, "36")], "", "36");
    assert.equal(picked.selected?.skuId, 2);
    assert.equal(picked.needSize, false);
  });

  it("sole real color auto-resolves, size still required when many", () => {
    const r = resolveSelection([V(1, "Dù", "M"), V(2, "Dù", "L")], "", "");
    assert.equal(r.effColor, "Dù");
    assert.equal(r.needColor, false);
    assert.equal(r.needSize, true);
    assert.equal(r.selected, undefined);
  });

  it("sole real color + sole real size auto-resolves without any click", () => {
    const r = resolveSelection([V(1, "Dù", "M"), V(2, "Da", "M")], "", "");
    // two colors here — choice required; single-size auto only after color pick
    assert.equal(r.needColor, true);
    const one = resolveSelection([V(7, "Dù", "M")], "", "");
    assert.equal(one.selected?.skuId, 7);
  });

  it("duplicate normalized dimensions across SKUs: no arbitrary pick", () => {
    const r = resolveSelection([V(1, "Đen", "M"), V(2, "Đen", "M")], "Đen", "M");
    assert.equal(r.candidates.length, 2);
    assert.equal(r.selected, undefined);
    assert.equal(r.ambiguous, false); // real dims exist, user chose fully — still must not guess
  });

  it("explicit picks resolve exactly one SKU (2314 pattern)", () => {
    const vs = [V(1, "Dù", "M"), V(2, "Dù", "L"), V(3, "Da", "M")];
    const r = resolveSelection(vs, "Da", "M");
    assert.equal(r.selected?.skuId, 3);
  });
});

describe("axisLabel (honest axis names — no fake Màu/Kích cỡ)", () => {
  it("real colors keep Màu, real sizes keep Kích cỡ", () => {
    assert.equal(axisLabel(["Đen", "Trắng"], "color"), "Màu");
    assert.equal(axisLabel(["Xanh Navy", "Kem (Chấm Bi)"], "color"), "Màu");
    assert.equal(axisLabel(["Black", "White"], "color"), "Màu");
    assert.equal(axisLabel(["M", "L", "XL"], "size"), "Kích cỡ");
    assert.equal(axisLabel(["36", "42.5", "Freesize"], "size"), "Kích cỡ");
  });

  it("3129 pre-order text never shows Màu — neutral Tuỳ chọn", () => {
    assert.equal(
      axisLabel(["Đặt hàng trong 2 tuần (cọc 20%)", "Đặt hàng trong 1 tuần (cọc 40%)"], "color"),
      "Tuỳ chọn",
    );
  });

  it("mixed color + non-color goes neutral (never half-Màu)", () => {
    assert.equal(axisLabel(["Đen", "Đặt hàng trong 1 tuần (cọc 40%)"], "color"), "Tuỳ chọn");
  });

  it("non-size text on the size axis goes neutral Phiên bản", () => {
    assert.equal(axisLabel(["Đợt 1", "Đợt 2"], "size"), "Phiên bản");
  });
});

describe("isColorValue / isSizeValue", () => {
  it("spots colors incl. diacritic/typo variants, rejects prose", () => {
    assert.equal(isColorValue("Trắng"), true);
    assert.equal(isColorValue("TRẮNG"), true);
    assert.equal(isColorValue("XANH DƯƠNG"), true);
    assert.equal(isColorValue("Ve chai"), true);
    assert.equal(isColorValue("Đặt hàng trong 2 tuần (cọc 20%)"), false);
    assert.equal(isColorValue("Cái"), false);
    assert.equal(isColorValue(""), false);
    assert.equal(isColorValue(null), false);
  });

  it("spots sizes, rejects prose", () => {
    assert.equal(isSizeValue("M"), true);
    assert.equal(isSizeValue("42.5"), true);
    assert.equal(isSizeValue("Freesize"), true);
    assert.equal(isSizeValue("Đợt 1"), false);
    assert.equal(isSizeValue("Không xác định"), false);
  });
});
