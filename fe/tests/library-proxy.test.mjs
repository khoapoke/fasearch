// Own-library proxy allowlist: frozen paths forward, everything else fails closed.
// Run: node --test tests/library-proxy.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { libraryBackendPath } from "../src/lib/library-proxy.ts";

describe("libraryBackendPath", () => {
  it("forwards the frozen library paths with query intact", () => {
    assert.equal(
      libraryBackendPath(["saved-products"], "?size=20"),
      "/api/v1/me/saved-products?size=20",
    );
    assert.equal(
      libraryBackendPath(["saved-products", "p1"], ""),
      "/api/v1/me/saved-products/p1",
    );
    assert.equal(
      libraryBackendPath(["search-history"], "?mode=TEXT"),
      "/api/v1/me/search-history?mode=TEXT",
    );
    assert.equal(
      libraryBackendPath(["library-preferences"], ""),
      "/api/v1/me/library-preferences",
    );
  });
  it("rejects other namespaces, deep paths and unsafe segments", () => {
    assert.equal(libraryBackendPath(["auth", "me"], ""), null);
    assert.equal(libraryBackendPath(["search-history", "a", "b"], ""), null);
    assert.equal(libraryBackendPath(["library-preferences", "x"], ""), null);
    assert.equal(libraryBackendPath(["saved-products", "../x"], ""), null);
    assert.equal(libraryBackendPath([], ""), null);
    assert.equal(libraryBackendPath(undefined, ""), null);
  });
});
