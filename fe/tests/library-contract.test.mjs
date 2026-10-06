// Personal-library contract mirrors (server authoritative).
// Run: node --test tests/library-contract.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  groupHistoryByDay,
  modeLabel,
  parseLibraryMode,
  parseLibraryPage,
  textResearchHref,
  validProductId,
} from "../src/lib/library-contract.ts";

describe("validProductId", () => {
  it("accepts canonical catalog identities", () => {
    assert.equal(validProductId("p1"), true);
    assert.equal(validProductId("dataset-a-10011-v1"), true);
  });
  it("rejects traversal, blanks and overlong ids", () => {
    assert.equal(validProductId("../etc"), false);
    assert.equal(validProductId(""), false);
    assert.equal(validProductId("x".repeat(129)), false);
    assert.equal(validProductId(null), false);
  });
});

describe("parseLibraryMode", () => {
  it("keeps the three known modes, rejects the rest", () => {
    assert.equal(parseLibraryMode("TEXT"), "TEXT");
    assert.equal(parseLibraryMode(null), null);
    assert.equal(parseLibraryMode("VIDEO"), null);
  });
});

describe("parseLibraryPage", () => {
  it("falls back safely on invalid page/size", () => {
    assert.deepEqual(parseLibraryPage(new URLSearchParams("page=2&size=10")), { page: 2, size: 10 });
    assert.deepEqual(parseLibraryPage(new URLSearchParams("page=0&size=500")), { page: 1, size: 20 });
  });
});

describe("groupHistoryByDay", () => {
  it("groups newest day first and keeps entry order", () => {
    const items = [
      { id: "a", mode: "TEXT", created_at: "2026-10-05T10:00:00Z" },
      { id: "b", mode: "IMAGE", created_at: "2026-10-06T10:00:00Z" },
      { id: "c", mode: "TEXT", created_at: "2026-10-05T12:00:00Z" },
    ];
    const groups = groupHistoryByDay(items);
    assert.deepEqual(groups.map((g) => g.day), ["2026-10-06", "2026-10-05"]);
    assert.deepEqual(groups[1].items.map((i) => i.id), ["a", "c"]);
  });
});

describe("labels and hrefs", () => {
  it("labels modes in Vietnamese and builds research links", () => {
    assert.equal(modeLabel("IMAGE"), "Ảnh");
    assert.equal(textResearchHref("váy đỏ"), "/search/text?q=v%C3%A1y%20%C4%91%E1%BB%8F");
  });
});
