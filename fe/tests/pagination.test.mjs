// Pagination window + jump validation (pure logic).
// Run: node --test tests/pagination.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pageWindow, parseJumpInput, visibleRange } from "../src/lib/pagination.ts";

describe("pageWindow", () => {
  it("lists all pages when few", () => {
    assert.deepEqual(pageWindow(1, 1).map((t) => t.kind), ["page"]);
    assert.deepEqual(
      pageWindow(3, 5).filter((t) => t.kind === "page").map((t) => t.page),
      [1, 2, 3, 4, 5],
    );
  });

  it("centers current ±2 with first/last and gaps", () => {
    const w = pageWindow(27, 42);
    assert.deepEqual(
      w.filter((t) => t.kind === "page").map((t) => t.page),
      [1, 25, 26, 27, 28, 29, 42],
    );
    assert.equal(w.filter((t) => t.kind === "gap").length, 2);
  });

  it("avoids redundant ellipsis near boundaries", () => {
    const start = pageWindow(2, 42).filter((t) => t.kind === "page").map((t) => t.page);
    assert.deepEqual(start, [1, 2, 3, 4, 5, 6, 7, 42]);
    const end = pageWindow(41, 42).filter((t) => t.kind === "page").map((t) => t.page);
    assert.deepEqual(end, [1, 36, 37, 38, 39, 40, 41, 42]);
  });

  it("never emits page 0 or beyond last", () => {
    for (const total of [8, 42, 366]) {
      for (const cur of [1, 2, total - 1, total]) {
        for (const t of pageWindow(cur, total)) {
          if (t.kind === "page") assert.ok(t.page >= 1 && t.page <= total);
        }
      }
    }
  });
});

describe("parseJumpInput", () => {
  it("accepts a valid 1-based page", () => {
    assert.deepEqual(parseJumpInput("27", 42), { page: 27 });
    assert.deepEqual(parseJumpInput("  1 ", 42), { page: 1 });
  });

  it("rejects empty/zero/negative/decimal/words/huge", () => {
    assert.deepEqual(parseJumpInput("", 42), { error: "empty" });
    assert.deepEqual(parseJumpInput("0", 42), { error: "outOfRange" });
    assert.deepEqual(parseJumpInput("-3", 42), { error: "nan" });
    assert.deepEqual(parseJumpInput("2.5", 42), { error: "nan" });
    assert.deepEqual(parseJumpInput("abc", 42), { error: "nan" });
    assert.deepEqual(parseJumpInput("43", 42), { error: "outOfRange" });
    assert.deepEqual(parseJumpInput("99999999999999999999", 42), { error: "outOfRange" });
  });
});

describe("visibleRange", () => {
  it("computes 1-based ranges from server metadata", () => {
    assert.deepEqual(visibleRange(2, 6, 2195), { from: 13, to: 18 });
    assert.deepEqual(visibleRange(365, 6, 2195), { from: 2191, to: 2195 });
  });

  it("returns null for empty or overrun pages", () => {
    assert.equal(visibleRange(0, 6, 0), null);
    assert.equal(visibleRange(5, 6, 12), null);
  });
});
