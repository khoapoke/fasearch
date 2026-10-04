// Client validation checks for the live composed workbench.
// Run: node --test tests/composed-workbench.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_TEXT_CODE_POINTS,
  codePointCount,
  modelView,
  validateComposedInput,
} from "../src/components/composed-search/validation.ts";

function jpegFile(size, type = "image/jpeg") {
  return { name: "query.jpg", type, size };
}

describe("composed workbench validation", () => {
  it("counts Unicode code points, not UTF-16 units", () => {
    assert.equal(codePointCount("áo"), 2);
    assert.equal(codePointCount("😀"), 1);
    assert.equal(MAX_TEXT_CODE_POINTS, 1024);
  });

  it("collapses whitespace like the backend model view", () => {
    assert.equal(modelView("  \u0111\u1ed5i\u00a0  sang  navy  "), "\u0111\u1ed5i sang navy");
    assert.equal(modelView("\u00a0 "), "");
  });

  it("accepts a complete valid input", () => {
    assert.equal(
      validateComposedInput({ file: jpegFile(1024), text: "đổi sang màu navy", k: 10 }),
      null,
    );
  });

  it("rejects missing/invalid files", () => {
    assert.match(
      validateComposedInput({ file: null, text: "x", k: 10 }) ?? "",
      /ảnh/,
    );
    assert.equal(
      validateComposedInput({ file: jpegFile(10, "image/gif"), text: "x", k: 10 }),
      "Chọn ảnh JPEG, PNG hoặc WebP.",
    );
    assert.equal(
      validateComposedInput({ file: jpegFile(10 * 1024 * 1024 + 1), text: "x", k: 10 }),
      "Ảnh phải nhỏ hơn hoặc bằng 10 MiB.",
    );
  });

  it("rejects overlong/empty text and out-of-range k", () => {
    assert.equal(
      validateComposedInput({ file: jpegFile(10), text: "x".repeat(1025), k: 10 }),
      "Mô tả thay đổi tối đa 1024 ký tự.",
    );
    assert.match(
      validateComposedInput({ file: jpegFile(10), text: "   ", k: 10 }) ?? "",
      /mô tả/,
    );
    assert.equal(
      validateComposedInput({ file: jpegFile(10), text: "x", k: 0 }),
      "Số kết quả K phải từ 1 đến 100.",
    );
    assert.equal(
      validateComposedInput({ file: jpegFile(10), text: "x", k: 101 }),
      "Số kết quả K phải từ 1 đến 100.",
    );
  });
});
