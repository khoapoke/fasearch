// Account return allowlist + client validation mirrors (server authoritative).
// Run: node --test tests/account-contract.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  safeAccountReturnHref,
  validateUsernameInput,
  validateEmailInput,
  validateNewPasswordInput,
} from "../src/lib/account-contract.ts";

describe("safeAccountReturnHref", () => {
  it("falls back for missing, external, or protocol-relative targets", () => {
    assert.equal(safeAccountReturnHref(null), "/tai-khoan");
    assert.equal(safeAccountReturnHref(""), "/tai-khoan");
    assert.equal(safeAccountReturnHref("https://evil.test/x"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("//evil.test/x"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/\\evil"), "/tai-khoan");
  });

  it("rejects dot-dot traversal including encoded variants", () => {
    assert.equal(safeAccountReturnHref("/tai-khoan/../dang-nhap"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/tai-khoan/%2e%2e/x"), "/tai-khoan");
  });

  it("keeps only real slice routes", () => {
    assert.equal(safeAccountReturnHref("/tai-khoan/thong-tin"), "/tai-khoan/thong-tin");
    assert.equal(safeAccountReturnHref("/"), "/");
    assert.equal(safeAccountReturnHref("/catalog"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/search/text"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/dang-ky"), "/tai-khoan");
  });
});

describe("validateUsernameInput", () => {
  it("mirrors the template VARCHAR(50) bound", () => {
    assert.equal(validateUsernameInput("nguoi_dung.01"), null);
    assert.ok(validateUsernameInput("") !== null);
    assert.ok(validateUsernameInput("a".repeat(51)) !== null);
    assert.equal(validateUsernameInput("a".repeat(50)), null);
    assert.ok(validateUsernameInput("có dấu") !== null);
  });
});

describe("validateEmailInput", () => {
  it("mirrors the template VARCHAR(100) bound", () => {
    assert.equal(validateEmailInput("nguoi01@example.test"), null);
    assert.ok(validateEmailInput("not-an-email") !== null);
    assert.ok(validateEmailInput(`${"a".repeat(95)}@x.test`) !== null);
  });
});

describe("validateNewPasswordInput", () => {
  it("accepts a compliant passphrase and rejects the rest", () => {
    assert.equal(validateNewPasswordInput("a-very-long-test-passphrase-01"), null);
    assert.ok(validateNewPasswordInput("short") !== null);
    assert.ok(validateNewPasswordInput("😀".repeat(20)) !== null);
  });
});
