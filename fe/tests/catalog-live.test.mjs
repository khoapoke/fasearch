// Live-search decisions + price/option helpers used by the real listing.
// Run: node --test tests/catalog-live.test.mjs   (from the fe/ directory)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { KEYWORD_DEBOUNCE_MS, SLOW_LOAD_MS, shouldDebounceKeyword } from "../src/lib/catalog-live.ts";
import { clampThumb, optionFingerprint, PRICE_STEP } from "../src/lib/study-helpers.ts";
import { parseExactPrice } from "../src/lib/study-price.ts";
import { parseJumpInput } from "../src/lib/pagination.ts";

describe("live keyword", () => {
  it("debounce is within 400-500ms and slow threshold is shorter", () => {
    assert.ok(KEYWORD_DEBOUNCE_MS >= 400 && KEYWORD_DEBOUNCE_MS <= 500);
    assert.ok(SLOW_LOAD_MS < KEYWORD_DEBOUNCE_MS);
  });
  it("never schedules mid IME composition", () => {
    assert.equal(shouldDebounceKeyword("ao so", "", true), false);
  });
  it("schedules after composition end when text differs", () => {
    assert.equal(shouldDebounceKeyword("áo sơ mi", "", false), true);
  });
  it("does not schedule when the draft equals the committed query", () => {
    assert.equal(shouldDebounceKeyword("ao", "ao", false), false);
  });
});

describe("ghost-free option identity", () => {
  it("equal-count lists with different members differ", () => {
    assert.notEqual(optionFingerprint(["all", "bape"]), optionFingerprint(["all", "adidas"]));
  });
});

describe("price", () => {
  it("clamp keeps the inactive thumb exact", () => {
    assert.deepEqual(clampThumb([0, 1000001], 0, 0, 5000000), [0, 1000001]);
    assert.equal(PRICE_STEP, 50000);
  });
  it("blank is unbounded, junk is invalid", () => {
    assert.deepEqual(parseExactPrice(""), { kind: "blank" });
    assert.deepEqual(parseExactPrice("500000"), { kind: "value", value: 500000 });
    assert.equal(parseExactPrice("-5").kind, "invalid");
    assert.equal(parseExactPrice("1,5").kind, "invalid");
  });
});

describe("direct page entry", () => {
  it("validates range and never clamps", () => {
    assert.deepEqual(parseJumpInput("3", 10), { page: 3 });
    assert.equal(parseJumpInput("0", 10).error, "outOfRange");
    assert.equal(parseJumpInput("11", 10).error, "outOfRange");
    assert.equal(parseJumpInput("", 10).error, "empty");
    assert.equal(parseJumpInput("2x", 10).error, "nan");
  });
});
