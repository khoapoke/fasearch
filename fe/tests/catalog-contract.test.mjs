// Catalog discovery contract helpers: exact detail/anchor URLs carry the
// product version + snapshot from actual API responses, never raw queries.
// Run: node --test tests/catalog-contract.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  composedAnchorHref,
  detailHref,
  parseCatalogView,
  detailContextQuery,
  parseCatalogAnchor,
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
  it("keeps allowlisted local routes, dropping untrusted query", () => {
    assert.equal(safeReturnHref("/catalog"), "/catalog");
    assert.equal(safeReturnHref("/catalog?page=3"), "/catalog");
    assert.equal(safeReturnHref("/search/text"), "/search/text");
    assert.equal(safeReturnHref("/search/composed"), "/search/composed");
    assert.equal(safeReturnHref("/catalog/10011?v=x&s=y"), "/catalog/10011");
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
    assert.deepEqual(view, { category: "TOP", page: 3, size: 24 });
  });

  it("falls back to defaults on invalid input", () => {
    assert.deepEqual(parseCatalogView(new URLSearchParams("")), {
      category: null,
      page: 1,
      size: 24,
    });
    assert.deepEqual(
      parseCatalogView(new URLSearchParams("category=SHOES&page=-2")),
      { category: null, page: 1, size: 24 },
    );
    assert.deepEqual(parseCatalogView(new URLSearchParams("page=abc")), {
      category: null,
      page: 1,
      size: 24,
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


describe("closure regressions", () => {
  it("honors bounded size URL input", () => {
    assert.equal(parseCatalogView(new URLSearchParams("size=60&page=2")).size, 60);
    assert.equal(parseCatalogView(new URLSearchParams("size=0")).size, 24);
    assert.equal(parseCatalogView(new URLSearchParams("size=61")).size, 24);
  });
  it("return route rejects URL normalization escapes and private catalog routes", () => {
    for (const raw of ["/catalog/..\\admin", "/catalog/%2e%2e", "/catalog/drafts", "/catalog/%2fadmin", "/catalog/."]) {
      assert.equal(safeReturnHref(raw), "/catalog");
    }
  });
});


describe("expected context never falls back", () => {
  it("forwards partial, blank and duplicate detail context for typed backend rejection", () => {
    assert.equal(detailContextQuery(new URLSearchParams("v=wrong")), "product_version_id=wrong");
    assert.equal(detailContextQuery(new URLSearchParams("s=stale")), "catalog_snapshot_id=stale");
    assert.equal(detailContextQuery(new URLSearchParams("v=&s=stale")), "product_version_id=&catalog_snapshot_id=stale");
    assert.equal(detailContextQuery(new URLSearchParams("v=a&v=b&s=s")), "product_version_id=a&product_version_id=b&catalog_snapshot_id=s");
    assert.equal(detailContextQuery(new URLSearchParams()), "");
  });
  it("distinguishes absent PRODUCT URL from malformed PRODUCT context", () => {
    assert.equal(parseCatalogAnchor(new URLSearchParams()).status, "absent");
    for (const query of ["anchor_product_id=10011", "anchor_product_id=&anchor_product_version_id=v&anchor_catalog_snapshot_id=s", "anchor_product_id=a&anchor_product_id=b&anchor_product_version_id=v&anchor_catalog_snapshot_id=s"]) {
      assert.equal(parseCatalogAnchor(new URLSearchParams(query)).status, "invalid");
    }
    assert.deepEqual(parseCatalogAnchor(new URLSearchParams("anchor_product_id=10011&anchor_product_version_id=v&anchor_catalog_snapshot_id=s")), {status:"valid",reference:{productId:"10011",productVersionId:"v",snapshotId:"s"}});
  });
});
