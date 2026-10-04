// Catalog discovery contract helpers: exact detail/anchor URLs carry the
// product version + snapshot from actual API responses, never raw queries.
// Run: node --test tests/catalog-contract.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  composedAnchorHref,
  detailHref,
  parseCatalogView,
  safeReturnHref,
} from "../src/lib/catalog-contract.ts";

describe("detailHref", () => {
  it("carries version and snapshot as query, not raw search text", () => {
    const href = detailHref("10011", "dataset-a-10011-v1", "catalog-20260908-pilot-v1");
    assert.equal(
      href,
      "/catalog/10011?v=dataset-a-10011-v1&s=catalog-20260908-pilot-v1",
    );
  });

  it("encodes unsafe product ids", () => {
    const href = detailHref("a/b c", "v1", "s1");
    assert.ok(href.startsWith("/catalog/a%2Fb%20c?"));
  });
});

describe("safeReturnHref", () => {
  it("keeps allowlisted local routes", () => {
    assert.equal(safeReturnHref("/catalog"), "/catalog");
    assert.equal(safeReturnHref("/catalog?page=3"), "/catalog?page=3");
    assert.equal(safeReturnHref("/search/text"), "/search/text");
    assert.equal(safeReturnHref("/search/composed"), "/search/composed");
    assert.equal(safeReturnHref("/catalog/10011?v=x&s=y"), "/catalog/10011?v=x&s=y");
  });

  it("rejects external and open-redirect targets", () => {
    assert.equal(safeReturnHref(null), "/catalog");
    assert.equal(safeReturnHref("https://evil.test/x"), "/catalog");
    assert.equal(safeReturnHref("//evil.test/x"), "/catalog");
    assert.equal(safeReturnHref("/admin/secrets"), "/catalog");
    assert.equal(safeReturnHref("/catalog/10011/extra"), "/catalog");
  });
});

describe("parseCatalogView", () => {
  it("accepts valid category and page", () => {
    const view = parseCatalogView(new URLSearchParams("category=TOP&page=3"));
    assert.deepEqual(view, { category: "TOP", page: 3 });
  });

  it("falls back to defaults on invalid input", () => {
    assert.deepEqual(parseCatalogView(new URLSearchParams("")), {
      category: null,
      page: 1,
    });
    assert.deepEqual(
      parseCatalogView(new URLSearchParams("category=SHOES&page=-2")),
      { category: null, page: 1 },
    );
    assert.deepEqual(parseCatalogView(new URLSearchParams("page=abc")), {
      category: null,
      page: 1,
    });
  });
});
describe("composedAnchorHref", () => {
  it("builds the exact anchor triple for PRODUCT search", () => {
    const href = composedAnchorHref("10011", "dataset-a-10011-v1", "catalog-20260908-pilot-v1");
    const url = new URL(href, "http://localhost");
    assert.equal(url.pathname, "/search/composed");
    assert.equal(url.searchParams.get("anchor_product_id"), "10011");
    assert.equal(url.searchParams.get("anchor_product_version_id"), "dataset-a-10011-v1");
    assert.equal(url.searchParams.get("anchor_catalog_snapshot_id"), "catalog-20260908-pilot-v1");
    assert.equal(url.searchParams.has("image"), false);
  });
});
