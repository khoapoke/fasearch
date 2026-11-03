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

test("account cluster sub-routes survive return sanitisation (F-02)", () => {
  for (const target of ["/tai-khoan/thong-tin", "/tai-khoan/dia-chi", "/tai-khoan/bao-mat", "/tai-khoan/diem-thuong", "/yeu-thich", "/lich-su-ai"]) {
    assert.equal(safeCustomerAuthReturn(target), target, target);
  }
});

test("still refuses encoded, query and unknown targets (F-02)", () => {
  for (const target of ["/yeu-thich?x=1", "%2Fyeu-thich", "/unknown-route"]) {
    assert.equal(safeCustomerAuthReturn(target), "/tai-khoan", target);
  }
});
