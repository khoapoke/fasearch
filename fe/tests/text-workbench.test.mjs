// Client validation checks for the TEXT workbench.
// Run: node --test tests/text-workbench.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_TEXT_CODE_POINTS,
  codePointCount,
  modelView,
  validateTextInput,
} from "../src/components/text-search/validation.ts";

describe("text workbench validation", () => {
  it("counts Unicode code points, not UTF-16 units", () => {
    assert.equal(codePointCount("áo"), 2);
    assert.equal(codePointCount("😀"), 1);
    assert.equal(MAX_TEXT_CODE_POINTS, 1024);
  });

  it("collapses whitespace like the backend model view", () => {
    assert.equal(modelView("  váy\u00a0  đỏ  "), "váy đỏ");
    assert.equal(modelView("  "), "");
  });

  it("accepts a complete valid input", () => {
    assert.equal(validateTextInput({ text: "váy đỏ", k: 10 }), null);
  });

  it("rejects blank/overlong text and bad k", () => {
    assert.match(validateTextInput({ text: "   ", k: 10 }) ?? "", /mô tả|Nhập/);
    assert.match(validateTextInput({ text: "x".repeat(1025), k: 10 }) ?? "", /1024/);
    assert.match(validateTextInput({ text: "váy", k: 0 }) ?? "", /K/);
    assert.match(validateTextInput({ text: "váy", k: 101 }) ?? "", /K/);
  });
});
