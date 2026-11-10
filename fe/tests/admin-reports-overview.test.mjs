// Run: node --test tests/admin-reports-overview.test.mjs   (from fe/)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays, computeDelta, daysBetween, groupPayments, presetOf, previousRange, topCategories, REPORT_PRESETS,
} from "../src/lib/admin-reports-overview.ts";

describe("computeDelta", () => {
  it("never divides by zero", () => {
    assert.equal(computeDelta(5, 0).kind, "none");
    assert.equal(computeDelta(0, 0).kind, "none");
    assert.equal(computeDelta(5, null).kind, "none");
    assert.equal(computeDelta(5, undefined).pct, null);
  });
  it("up, down, flat", () => {
    assert.deepEqual([computeDelta(150, 100).kind, computeDelta(150, 100).pct], ["up", 50]);
    assert.deepEqual([computeDelta(50, 100).kind, computeDelta(50, 100).pct], ["down", -50]);
    assert.equal(computeDelta(100, 100).kind, "flat");
    assert.equal(computeDelta(0, 100).pct, -100);
  });
});

describe("ranges", () => {
  it("previous period has the same length and ends the day before", () => {
    assert.deepEqual(previousRange("2026-11-03", "2026-11-04"), ["2026-11-01", "2026-11-02"]);
    assert.deepEqual(previousRange("2026-11-01", "2026-11-08"), ["2026-10-24", "2026-10-31"]);
    assert.equal(daysBetween("2026-11-01", "2026-11-08"), 7);
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });
  it("presets", () => {
    assert.deepEqual(REPORT_PRESETS.find((p) => p.id === "7").range("2026-11-08"), ["2026-11-02", "2026-11-08"]);
    assert.deepEqual(REPORT_PRESETS.find((p) => p.id === "last-month").range("2026-11-08"), ["2026-10-01", "2026-10-31"]);
    assert.deepEqual(REPORT_PRESETS.find((p) => p.id === "last-month").range("2026-01-15"), ["2025-12-01", "2025-12-31"]);
    assert.equal(presetOf("2026-11-01", "2026-11-08", "2026-11-08"), "month");
    assert.equal(presetOf("2026-11-03", "2026-11-04", "2026-11-08"), "custom");
  });
});

describe("grouping", () => {
  it("payments merge by label, fold the rest into Khác, at most 5 slices", () => {
    const rows = [
      { method: "CASH", invoices: 1, revenue: 100 }, { method: "COD", invoices: 1, revenue: 50 },
      { method: "STRIPE", invoices: 1, revenue: 40 }, { method: "VNPAY_QR", invoices: 1, revenue: 30 },
      { method: "MOMO", invoices: 1, revenue: 20 }, { method: "OTHER", invoices: 1, revenue: 10 }, { method: "ZALO", invoices: 1, revenue: 5 },
    ];
    const g = groupPayments(rows, 5);
    assert.deepEqual(g.map((s) => [s.method, s.revenue]), [["Tiền mặt", 150], ["Stripe", 40], ["VNPay", 30], ["Khác", 35]]);
    assert.equal(g.reduce((s, x) => s + x.invoices, 0), 7);
  });
  it("categories keep the top 8 and fold the remainder", () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ categoryId: i, categoryName: `C${i}`, revenue: 100 - i, quantity: 1 }));
    const t = topCategories(rows, 8);
    assert.equal(t.length, 9);
    assert.equal(t[8].categoryName, "Khác");
    assert.equal(t[8].revenue, 92 + 91 + 90);
    assert.equal(topCategories(rows.slice(0, 3), 8).length, 3);
  });
});
