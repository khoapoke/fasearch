// Run: node --test tests/reports.test.mjs   (from fe/)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMovementQuery, buildRevenueQuery, buildTopQuery, formatMoneyOrUnknown,
  normalizeMonth, normalizeTopN, reportCsvName, validateReportRange,
} from "../src/lib/reports.ts";
import { csvCell } from "../src/lib/reports-client.ts";

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

describe("contract query builders (BE CONTRACT v1)", () => {
  it("revenue pins period + HCMC day bounds + ALL channel", () => {
    const q = buildRevenueQuery({ tuNgay: "2026-10-01", denNgay: "2026-10-18", period: "WEEK" });
    assert.match(q, /period=WEEK/);
    assert.match(q, /startDate=2026-10-01/);
    assert.match(q, /channel=ALL/);
    assert.throws(() => buildRevenueQuery({ tuNgay: "2026-10-01", denNgay: "2026-10-18", period: "DECADE" }), /Chu kỳ/);
  });
  it("top pins type/limit with 1-100 bounds", () => {
    const q = buildTopQuery({ tuNgay: "2026-10-01", denNgay: "2026-10-18", type: "SLOW_MOVING", limit: 5 });
    assert.match(q, /type=SLOW_MOVING/);
    assert.match(q, /limit=5/);
    assert.throws(() => buildTopQuery({ tuNgay: "2026-10-01", denNgay: "2026-10-18", limit: 500 }), /Limit/);
    assert.equal(normalizeTopN(undefined), 10);
  });
  it("movement pins page/size/month/sku", () => {
    const q = buildMovementQuery({ tuNgay: "2026-10-01", denNgay: "2026-10-18", page: 1, size: 50, month: "10-2026", sku: "5" });
    assert.match(q, /page=1/);
    assert.match(q, /size=50/);
    assert.match(q, /month=10-2026/);
    assert.match(q, /sku=5/);
    assert.throws(() => buildMovementQuery({ tuNgay: "2026-10-01", denNgay: "2026-10-18", month: "2026-10" }), /MM-YYYY/);
    assert.equal(normalizeMonth(""), "");
  });
  it("csv name is safe, unknown stays unknown", () => {
    assert.equal(reportCsvName("doanh-thu", "2026-10-01", "2026-10-18"), "bao-cao-doanh-thu-2026-10-01-2026-10-18.csv");
    assert.equal(formatMoneyOrUnknown(null), "Chưa rõ");
    assert.equal(formatMoneyOrUnknown(150000), "150.000₫");
  });
  it("csvCell neutralizes formula injection", () => {
    assert.equal(csvCell("=SUM(A1:A2)"), "'=SUM(A1:A2)");
    assert.equal(csvCell("+123"), "'+123");
    assert.equal(csvCell("Vans Old Skool"), "Vans Old Skool");
    assert.equal(csvCell('a"b,c'), '"a""b,c"');
    assert.equal(csvCell(null), "");
  });
  it("csvCell keeps genuine numbers, including negative amounts", () => {
    assert.equal(csvCell(-5), "-5");
    assert.equal(csvCell(-150000.5), "-150000.5");
    assert.equal(csvCell("-5"), "'-5");
  });
});
