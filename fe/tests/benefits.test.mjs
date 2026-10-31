// Run: node --test tests/benefits.test.mjs (from fe/)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appliedBenefitsChanged, benefitErrorMessage, canonicalVoucherCode, discountKindLabel, loyaltyActionLabel,
  loyaltySignedPoints, splitPayable, validatePointsInput,
} from "../src/lib/benefits.ts";

describe("canonicalVoucherCode", () => {
  it("trim + uppercase", () => {
    assert.equal(canonicalVoucherCode("  welcome2026 "), "WELCOME2026");
  });
  it("rejects empty/bad charset/overlong", () => {
    assert.throws(() => canonicalVoucherCode("   "), /Nhập mã/);
    assert.throws(() => canonicalVoucherCode("SALE 30%"), /1–32/);
    assert.throws(() => canonicalVoucherCode("A".repeat(33)), /1–32/);
  });
});

describe("validatePointsInput (hand arithmetic: 20pts x 1000 on 150000 remaining)", () => {
  it("blank -> 0 (omitted keeps old behavior)", () => {
    assert.equal(validatePointsInput("", 100), 0);
  });
  it("accepts within available and merchandise", () => {
    assert.equal(validatePointsInput("20", 100, { remainingMerch: 150000, giaTriDiem: 1000 }), 20);
  });
  it("rejects non-integer/over-available/over-merchandise/over-server-cap", () => {
    assert.throws(() => validatePointsInput("2.5", 100), /nguyên/);
    assert.throws(() => validatePointsInput("-1", 100), /nguyên/);
    assert.throws(() => validatePointsInput("101", 100), /khả dụng/);
    assert.throws(() => validatePointsInput("200", 500, { remainingMerch: 150000, giaTriDiem: 1000 }), /tiền hàng/);
    assert.throws(() => validatePointsInput("30", 500, { allowedMax: 20 }), /tối đa 20/);
  });
});

describe("loyaltySignedPoints (ledger stores positive both sides)", () => {
  it("contract ledger types show net spends/holds and keep opening as baseline", () => {
    assert.equal(loyaltySignedPoints("REDEEM", 5), -5);
    assert.equal(loyaltySignedPoints("HOLD", 5), -5);
    assert.equal(loyaltySignedPoints("EARN", 5), 5);
    assert.equal(loyaltySignedPoints("RELEASE", 5), 5);
    assert.equal(loyaltySignedPoints("OPENING", 5), 0);
    assert.equal(loyaltyActionLabel("RELEASE"), "Nhả giữ");
  });
});

describe("splitPayable + labels + errors", () => {
  it("goods200000 voucher30000 points20000 -> due150000, never negative", () => {
    assert.equal(splitPayable(200000, 30000, 20000), 150000);
    assert.equal(splitPayable(10000, 8000, 5000), 0);
  });
  it("labels cover kinds/actions", () => {
    assert.equal(discountKindLabel("PHAN_TRAM"), "theo đơn");
    assert.equal(discountKindLabel("SO_TIEN"), "cố định");
    assert.equal(loyaltyActionLabel("OPENING"), "Số dư mở đầu");
  });
  it("maps expired/disabled/mismatch/insufficient/409 honestly", () => {
    assert.match(benefitErrorMessage(400, "VOUCHER_EXPIRED", "x"), /hết hạn/);
    assert.match(benefitErrorMessage(400, "POLICY_DISABLED", "x"), /tắt/);
    assert.match(benefitErrorMessage(400, "VOUCHER_MISMATCH", "x"), /không áp dụng/);
    assert.match(benefitErrorMessage(409, "INSUFFICIENT_POINTS", "x"), /vượt quá/);
    assert.match(benefitErrorMessage(409, "4204", "x"), /vượt quá/);
    assert.match(benefitErrorMessage(409, "4206", "x"), /Chính sách đã đổi/);
    assert.match(benefitErrorMessage(409, "4208", "x"), /thay đổi đồng thời/);
    assert.match(benefitErrorMessage(409, null, "x"), /Tải lại báo giá/);
  });
});

describe("appliedBenefitsChanged (R3-F1: dirty-trip must not stick the submit button)", () => {
  it("same applied inputs -> false (submit proceeds)", () => {
    assert.equal(appliedBenefitsChanged("FEE2E10", 2, "FEE2E10", 2), false);
    assert.equal(appliedBenefitsChanged(null, 0, null, 0), false);
  });
  it("edited voucher or points after quote -> true (re-quote required)", () => {
    assert.equal(appliedBenefitsChanged("OTHER", 2, "FEE2E10", 2), true);
    assert.equal(appliedBenefitsChanged("FEE2E10", 5, "FEE2E10", 2), true);
    assert.equal(appliedBenefitsChanged(null, 0, "FEE2E10", 0), true);
  });
});
