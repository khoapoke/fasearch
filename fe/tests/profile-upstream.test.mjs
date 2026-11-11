// PROM-S2-FE-PROFILE-UPSTREAM-01: the profile BFF must ride the same paired BE
// as login/my-info, never a per-module hardcoded port.
// Run: node --test tests/profile-upstream.test.mjs   (from the fe/ directory)

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authBackendUrl } from "../src/lib/server/be-upstream.ts";

const profileSource = readFileSync(new URL("../src/lib/server/customer-profile.ts", import.meta.url), "utf8");

afterEach(() => { delete process.env.FASEARCH_CUSTOMER_AUTH_BACKEND_URL; });

describe("authBackendUrl", () => {
  it("returns the configured paired upstream without trailing slashes", () => {
    process.env.FASEARCH_CUSTOMER_AUTH_BACKEND_URL = "http://127.0.0.1:18126///";
    assert.equal(authBackendUrl(), "http://127.0.0.1:18126");
  });

  it("refuses to fall back to an implicit upstream", () => {
    delete process.env.FASEARCH_CUSTOMER_AUTH_BACKEND_URL;
    assert.throws(() => authBackendUrl(), /auth backend not configured/);
  });
});

describe("customer profile BFF upstream", () => {
  it("keeps no hardcoded upstream in the profile module", () => {
    assert.equal(/https?:\/\//.test(profileSource), false);
  });

  it("routes both GET and PATCH through the shared paired selector", () => {
    const calls = profileSource.match(/\$\{authBackendUrl\(\)\}\/api\/v1\/users\/customers\/\$\{who\.customerId\}/g) ?? [];
    assert.equal(calls.length, 2);
    assert.match(profileSource, /method: "GET"/);
    assert.match(profileSource, /method: "PATCH"/);
  });
});
