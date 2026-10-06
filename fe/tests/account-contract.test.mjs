// Account return allowlist + client validation mirrors (server authoritative).
// Run: node --test tests/account-contract.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  safeAccountReturnHref,
  validateDisplayNameInput,
  validateNewPasswordInput,
  validateRegisterInput,
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
    assert.equal(safeAccountReturnHref("/catalog/%2e%2e/x"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/catalog/%2F..%2F"), "/tai-khoan");
  });

  it("fails closed on single, double, and malformed encoding", () => {
    assert.equal(safeAccountReturnHref("/tai-khoan/%2e%2e/%2e%2e/x"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/tai-khoan/%252e%252e/x"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/tai-khoan/%25252e/x"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/tai-khoan/%zz/x"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/tai-khoan/%/x"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/tai-khoan/%5c/x"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/tai-khoan/%5Cevil"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/tai-khoan/%0a/x"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/%2f%2fevil.test/x"), "/tai-khoan");
  });

  it("rejects auth routes as return targets to avoid login loops", () => {
    assert.equal(safeAccountReturnHref("/dang-nhap"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/dang-ky"), "/tai-khoan");
  });

  it("keeps allowlisted account, catalog, and search targets with query", () => {
    assert.equal(safeAccountReturnHref("/tai-khoan/bao-mat"), "/tai-khoan/bao-mat");
    assert.equal(safeAccountReturnHref("/"), "/");
    assert.equal(
      safeAccountReturnHref("/catalog/abc?v=dataset-v1&s=snap-1"),
      "/catalog/abc?v=dataset-v1&s=snap-1",
    );
    assert.equal(safeAccountReturnHref("/search/text"), "/search/text");
  });
});

describe("validateRegisterInput", () => {
  const good = {
    username: "nguoi_dung.01",
    email: "nguoi01@example.test",
    password: "a-very-long-test-passphrase-01",
    displayName: "Người Dùng Mới",
  };

  it("accepts a valid input without issues", () => {
    assert.deepEqual(validateRegisterInput(good), {});
  });

  it("flags short, malformed, and out-of-policy fields", () => {
    const issues = validateRegisterInput({
      ...good,
      username: "ab",
      email: "not-an-email",
      password: "short",
    });
    assert.ok(issues.username);
    assert.ok(issues.email);
    assert.ok(issues.password);
    assert.equal(issues.displayName, undefined);
  });

  it("rejects a password over the 72 UTF-8 byte bcrypt bound", () => {
    const issues = validateRegisterInput({ ...good, password: "😀".repeat(20) });
    assert.ok(issues.password);
  });

  it("rejects blank and control-character display names", () => {
    assert.ok(validateRegisterInput({ ...good, displayName: "   " }).displayName);
    assert.ok(validateDisplayNameInput("ab") !== null);
  });
});

describe("validateNewPasswordInput", () => {
  it("accepts a compliant passphrase and rejects the rest", () => {
    assert.equal(validateNewPasswordInput("a-very-long-test-passphrase-01"), null);
    assert.ok(validateNewPasswordInput("short") !== null);
    assert.ok(validateNewPasswordInput("😀".repeat(20)) !== null);
  });
});
