import assert from "node:assert/strict";
import test from "node:test";
import { safeCustomerAuthReturn } from "../src/lib/customer-auth-return.ts";

test("allows the exact ADMIN promotions deep link after login", () => {
  assert.equal(safeCustomerAuthReturn("/quan-tri/khuyen-mai"), "/quan-tri/khuyen-mai");
});

test("rejects external, encoded, and query-based open redirects", () => {
  for (const target of [
    "https://evil.example",
    "//evil.example/path",
    "/%2f%2fevil.example",
    "/quan-tri/khuyen-mai?next=https://evil.example",
    "/quan-tri/khuyen-mai/",
  ]) {
    assert.equal(safeCustomerAuthReturn(target), "/tai-khoan", target);
  }
});
