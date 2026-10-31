import assert from "node:assert/strict";
import test from "node:test";
import { policyBody, positiveId, tierBody } from "../src/lib/server/loyalty-validation.ts";

test("new policy defaults to DISABLED and only forwards contract fields", () => {
  assert.deepEqual(policyBody({ earnCurrencyPerPoint: 50000, redeemCurrencyPerPoint: 1000, injectedRole: "ADMIN" }, true), {
    earnCurrencyPerPoint: 50000, redeemCurrencyPerPoint: 1000, status: "DISABLED",
  });
});

test("policy versions require valid current version, full money values, and explicit status enum", () => {
  assert.deepEqual(policyBody({ version: 2, earnCurrencyPerPoint: 50000.25, redeemCurrencyPerPoint: 1000, status: "ENABLED" }, false), {
    earnCurrencyPerPoint: 50000.25, redeemCurrencyPerPoint: 1000, status: "ENABLED", version: 2,
  });
  for (const body of [
    { version: 0, earnCurrencyPerPoint: 1, redeemCurrencyPerPoint: 1, status: "DISABLED" },
    { version: 1, earnCurrencyPerPoint: 1, redeemCurrencyPerPoint: 1.001, status: "DISABLED" },
    { version: 1, earnCurrencyPerPoint: 0, redeemCurrencyPerPoint: 1, status: "DISABLED" },
    { version: 1, earnCurrencyPerPoint: 1, redeemCurrencyPerPoint: 1, status: "AUTO" },
  ]) assert.equal(policyBody(body, false), null);
});

test("tier writes require optimistic version and nonnegative currency threshold", () => {
  assert.deepEqual(tierBody({ version: 3, minimumCumulativePaidSales: 0 }), { version: 3, minimumCumulativePaidSales: 0 });
  assert.deepEqual(tierBody({ version: 1, minimumCumulativePaidSales: 2500000.5 }), { version: 1, minimumCumulativePaidSales: 2500000.5 });
  assert.equal(tierBody({ version: 1, minimumCumulativePaidSales: -1 }), null);
  assert.equal(tierBody({ version: 1.5, minimumCumulativePaidSales: 1 }), null);
  assert.equal(tierBody({ version: 1, minimumCumulativePaidSales: 1.234 }), null);
});

test("path ids reject zero, leading-zero, unsafe, and nonnumeric values", () => {
  assert.equal(positiveId("42"), 42);
  for (const value of ["0", "01", "-1", "1.5", "9007199254740992", "admin"]) assert.equal(positiveId(value), null);
});
