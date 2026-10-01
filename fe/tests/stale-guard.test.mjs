// Regression test for AC-05: a slow earlier image-search response must never
// replace newer selection/reset state. Tests the pure request-identity guard
// used by image-search-workbench.tsx (paired there with AbortController).
// Run: node --test tests/stale-guard.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequestGuard } from "../src/components/stitch-search/request-guard.ts";

describe("request guard", () => {
  it("accepts the latest ticket", () => {
    const guard = createRequestGuard();
    const ticket = guard.begin();
    assert.equal(guard.isCurrent(ticket), true);
  });

  it("marks the first request stale when a second one begins", () => {
    const guard = createRequestGuard();
    const first = guard.begin();
    const second = guard.begin();
    assert.equal(guard.isCurrent(first), false);
    assert.equal(guard.isCurrent(second), true);
  });

  it("marks everything stale on invalidate (image change / reset)", () => {
    const guard = createRequestGuard();
    const ticket = guard.begin();
    guard.invalidate();
    assert.equal(guard.isCurrent(ticket), false);
  });

  it("rejects unknown tickets", () => {
    const guard = createRequestGuard();
    guard.begin();
    assert.equal(guard.isCurrent({ id: 999 }), false);
  });
});
