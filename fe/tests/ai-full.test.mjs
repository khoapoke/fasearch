// Run: node --test tests/ai-full.test.mjs (from fe/)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkImageDimensions, describeAiStatus, isPurchasable, validateComposed, validateImageFile,
} from "../src/lib/ai-full.ts";

function file(type, size) {
  return { type, size };
}

describe("validateImageFile", () => {
  it("accepts JPEG/PNG within 5MiB", () => {
    validateImageFile(file("image/jpeg", 1024));
    validateImageFile(file("image/png", 5 * 1024 * 1024));
  });
  it("rejects gif/webp/oversize", () => {
    assert.throws(() => validateImageFile(file("image/gif", 100)), /JPEG\/PNG/);
    assert.throws(() => validateImageFile(file("image/jpeg", 5 * 1024 * 1024 + 1)), /5MiB/);
  });
});

describe("dimensions + composed", () => {
  it("rejects over 4000px", () => {
    assert.throws(() => checkImageDimensions(4001, 10), /4000/);
    checkImageDimensions(4000, 4000);
  });
  it("composed needs both image and query", () => {
    assert.throws(() => validateComposed("", null), /ảnh/);
    assert.throws(() => validateComposed("", file("image/jpeg", 10)), /từ khóa/);
    assert.equal(validateComposed(" black shirt ", file("image/png", 10)).q, "black shirt");
  });
});

describe("status + purchasable honesty", () => {
  it("distinguishes not-ready vs ready-empty", () => {
    assert.match(describeAiStatus(null), /Chưa tải/);
    assert.match(describeAiStatus({ ready: false }), /chưa sẵn sàng/);
    assert.match(describeAiStatus({ ready: true, eligibleImageCount: 0 }), /rỗng hợp lệ/);
  });
  it("only explicit mapping is purchasable", () => {
    assert.equal(isPurchasable({ maSpLienKet: null }), false);
    assert.equal(isPurchasable({ maSpLienKet: 12 }), true);
  });
});
