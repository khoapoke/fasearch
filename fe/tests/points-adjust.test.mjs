// Run: node --test tests/points-adjust.test.mjs (from fe/). S3: ADJUST in storefront history and admin labels.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loyaltyActionLabel, loyaltyHistoryAmount, loyaltySignedPoints } from "../src/lib/benefits.ts";
import { ledgerTypeLabel, reasonLabel, RECALC_REASONS } from "../src/lib/admin-loyalty-client.ts";

describe("ADJUST in the storefront history", () => {
  it("shows the neutral shop label and never an internal note", () => {
    assert.equal(loyaltyActionLabel("ADJUST"), "Điều chỉnh bởi cửa hàng");
  });
  it("keeps the stored sign", () => {
    assert.equal(loyaltySignedPoints("ADJUST", -30), -30);
    assert.equal(loyaltySignedPoints("ADJUST", 12), 12);
    assert.deepEqual(loyaltyHistoryAmount("ADJUST", -30), { text: "−30 điểm", direction: "down" });
    assert.deepEqual(loyaltyHistoryAmount("ADJUST", 12), { text: "+12 điểm", direction: "up" });
    assert.equal(loyaltySignedPoints("REDEEM", 5), -5);
  });
});

describe("admin labels", () => {
  it("translate every ledger type and reason", () => {
    for (const t of ["OPENING", "HOLD", "RELEASE", "REDEEM", "EARN", "ADJUST"]) assert.notEqual(ledgerTypeLabel(t), t);
    assert.equal(reasonLabel("BOI_THUONG"), "Bồi thường");
    assert.equal(reasonLabel("TINH_LAI_DON"), "Tính lại điểm cho đơn");
    assert.equal(reasonLabel(null), null);
    assert.ok(RECALC_REASONS.ALREADY_EARNED);
  });
});
