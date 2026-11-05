// Email auth (Brevo/LOG) BFF + browser client contract.
// Run: node --test tests/email-auth-contract.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  requestPasswordReset,
  resetPassword,
  requestVerificationEmail,
  verifyEmail,
  AuthApiError,
} from "../src/lib/customer-auth-client.ts";

const ROUTES = [
  "src/app/api/customer-auth/password/forgot/route.ts",
  "src/app/api/customer-auth/password/reset/route.ts",
  "src/app/api/customer-auth/email/verification-request/route.ts",
  "src/app/api/customer-auth/email/verify/route.ts",
];

const PANELS = [
  "src/components/customer-auth/forgot-password-panel.tsx",
  "src/components/customer-auth/reset-password-panel.tsx",
  "src/components/customer-auth/verify-email-panel.tsx",
  "src/components/customer-auth/email-verification-banner.tsx",
];

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("email auth browser client", () => {
  it("exposes the four email flows as functions", () => {
    for (const fn of [requestPasswordReset, resetPassword, requestVerificationEmail, verifyEmail]) {
      assert.equal(typeof fn, "function");
    }
    assert.equal(typeof AuthApiError, "function");
  });
});

describe("email auth BFF routes", () => {
  for (const route of ROUTES) {
    it(`${route} rides the shared paired selector`, () => {
      const source = read(route);
      assert.match(source, /authBackendUrl\(\)/);
    });
    it(`${route} keeps no hardcoded upstream`, () => {
      const source = read(route);
      assert.equal(/https?:\/\//.test(source), false);
    });
  }

  it("forgot keeps the same generic success and never leaks account existence", () => {
    const source = read("src/app/api/customer-auth/password/forgot/route.ts");
    assert.match(source, /GENERIC_SUCCESS/);
    assert.equal(/tai khoan.*ton tai|account.*exist/i.test(source), false);
  });

  it("reset mirrors the BE password rule (6-100) so the BFF never rejects a valid password", () => {
    const source = read("src/app/api/customer-auth/password/reset/route.ts");
    assert.match(source, /newPassword\.length < 6/);
    assert.match(source, /newPassword\.length > 100/);
  });

  it("verification-request requires the session cookie", () => {
    const source = read("src/app/api/customer-auth/email/verification-request/route.ts");
    assert.match(source, /authCookie\(request\)/);
    assert.match(source, /AUTH_REQUIRED/);
  });
});

describe("email auth panels", () => {
  for (const panel of PANELS) {
    it(`${panel} renders no hardcoded backend or token`, () => {
      const source = read(panel);
      assert.equal(/https?:\/\//.test(source), false);
      assert.equal(/BREVO_API_KEY|api-key/i.test(source), false);
    });
  }

  it("verify panel auto-verifies once from the email link token", () => {
    const source = read("src/components/customer-auth/verify-email-panel.tsx");
    assert.match(source, /verifyEmail\(token/);
  });

  it("banner only offers resend and states login is not blocked", () => {
    const source = read("src/components/customer-auth/email-verification-banner.tsx");
    assert.match(source, /requestVerificationEmail/);
    assert.match(source, /vẫn đăng nhập/);
  });
});

describe("identity carries emailVerified", () => {
  it("server validator always yields a boolean", () => {
    const source = read("src/lib/server/customer-auth.ts");
    assert.match(source, /emailVerified: boolean/);
    assert.match(source, /typeof result\.emailVerified === "boolean"/);
  });
});
