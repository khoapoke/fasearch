// PROM-S2-FE-ADMIN-OVERVIEW-UPSTREAM-01: admin overview must ride the same BE
// as admin identity/auth (18126), never a stale hardcoded 18122.
// Run: node --test tests/admin-overview-upstream.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync(new URL("../src/app/api/admin/overview/route.ts", import.meta.url), "utf8");
const bffSource = readFileSync(new URL("../src/lib/server/admin-bff.ts", import.meta.url), "utf8");

describe("admin overview upstream", () => {
  it("does not hardcode the stale 18122 port", () => {
    assert.equal(routeSource.includes("127.0.0.1:18122"), false);
  });

  it("imports the paired BE from admin-bff", () => {
    assert.match(routeSource, /import\s*\{[^}]*\bBE\b[^}]*\}\s*from\s*"@\/lib\/server\/admin-bff"/);
  });

  it("admin-bff paired BE is 18126", () => {
    // The default stays the paired 18126 BE; FASEARCH_BACKEND_URL may override it.
    assert.match(bffSource, /const BE = (?:process\.env\.FASEARCH_BACKEND_URL\?\.replace\([^)]*\) \|\| )?"http:\/\/127\.0\.0\.1:18126";/);
  });

  it("still calls /api/v1/orders on the paired BE", () => {
    assert.match(routeSource, /\$\{BE\}\/api\/v1\/orders/);
  });
});
