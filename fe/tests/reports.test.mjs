// Run: node --test tests/reports.test.mjs (from fe/)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildReportQuery, formatMoneyOrUnknown, reportCsvName, validateReportRange,
} from "../src/lib/reports.ts";

describe("validateReportRange", () => {
  it("accepts bounded ranges", () => {
    assert.equal(validateReportRange("2026-10-01", "2026-10-18").days, 18);
  });
  it("rejects bad format/inverted/oversize", () => {
    assert.throws(() => validateReportRange("18/10/2026", "2026-10-18"), /YYYY-MM-DD/);
    assert.throws(() => validateReportRange("2026-10-18", "2026-10-01"), /trước hoặc bằng/);
    assert.throws(() => validateReportRange("2025-01-01", "2026-12-31"), /tối đa/);
  });
});

describe("buildReportQuery + csv + unknown", () => {
  it("emits stable params with topN bounds", () => {
    const q = buildReportQuery({ tuNgay: "2026-10-01", denNgay: "2026-10-18", kenhBan: "POS", topN: 5 });
    assert.match(q, /kenhBan=POS/);
    assert.match(q, /topN=5/);
    assert.throws(() => buildReportQuery({ tuNgay: "2026-10-01", denNgay: "2026-10-18", topN: 500 }), /TopN/);
  });
  it("only declared params are sent (no page/size unless set)", () => {
    const q = buildReportQuery({ tuNgay: "2026-10-01", denNgay: "2026-10-18" });
    assert.ok(!q.includes("page="));
    assert.ok(!q.includes("topN="));
    const qx = buildReportQuery({ tuNgay: "2026-10-01", denNgay: "2026-10-18", maKho: "1", sku: "5", page: 1, size: 50 });
    assert.match(qx, /maKho=1/);
    assert.match(qx, /maSku=5/);
  });
  it("csv name is safe, unknown stays unknown", () => {
    assert.equal(reportCsvName("doanh-thu", "2026-10-01", "2026-10-18"), "bao-cao-doanh-thu-2026-10-01-2026-10-18.csv");
    assert.equal(formatMoneyOrUnknown(null), "Chưa rõ");
    assert.equal(formatMoneyOrUnknown(150000), "150.000₫");
  });
});
