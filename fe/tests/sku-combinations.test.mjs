import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSkuCombinations } from "../src/lib/sku-combinations.ts";

describe("deliberate color x size SKU generation", () => {
  it("builds the full cross product with normalization", () => {
    const { combinations, skippedDuplicate } = buildSkuCombinations(
      ["Đen", " Trắng "],
      ["M", "L"],
      [],
    );
    assert.equal(skippedDuplicate, 0);
    assert.deepEqual(combinations, [
      { color: "Đen", size: "M" },
      { color: "Đen", size: "L" },
      { color: "Trắng", size: "M" },
      { color: "Trắng", size: "L" },
    ]);
  });

  it("skips combinations that already exist (case-insensitive) and reports them", () => {
    const { combinations, skippedDuplicate } = buildSkuCombinations(
      ["đen", "Đỏ"],
      ["m"],
      [{ color: "Đen", size: "M" }],
    );
    assert.equal(skippedDuplicate, 1);
    assert.deepEqual(combinations, [{ color: "Đỏ", size: "m" }]);
  });

  it("dedupes within the request and never emits an empty/empty row", () => {
    const { combinations, skippedDuplicate } = buildSkuCombinations(
      ["Đen", "đen", ""],
      ["", null],
      [],
    );
    assert.equal(skippedDuplicate, 1);
    assert.deepEqual(combinations, [{ color: "Đen", size: null }]);
  });

  it("does not invent stock or barcodes", () => {
    const { combinations } = buildSkuCombinations(["Xanh"], ["41"], []);
    for (const row of combinations) {
      assert.equal("stock" in row, false);
      assert.equal("barcode" in row, false);
    }
  });
});
