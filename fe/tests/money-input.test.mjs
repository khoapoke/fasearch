// Money input parsing (pure logic). Run: node --test tests/money-input.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MONEY_INVALID, moneyState, parseMoneyInput } from "../src/lib/money-input.ts";

const ok = (text, value) => assert.deepEqual(parseMoneyInput(text), { ok: true, value }, text);
const bad = (text) => assert.deepEqual(parseMoneyInput(text), { ok: false }, text);

describe("parseMoneyInput", () => {
  it("reads grouped and plain values", () => {
    ok("1.450.000", "1450000");
    ok("1450000", "1450000");
    ok("1.450", "1450");
    ok("350.000", "350000");
    ok("0", "0");
    ok("", "");
    ok("  ", "");
  });
  it("reads decimals with dot or comma", () => {
    ok("1450000.50", "1450000.5");
    ok("1450000,5", "1450000.5");
    ok("125000.5", "125000.5");
    ok("1.45", "1.45");
    ok("1.450.000,25", "1450000.25");
    ok("350000.00", "350000");
  });
  it("rejects ambiguous or non-numeric text instead of stripping it", () => {
    for (const text of ["12a", "1,450", "1.4500", "1450000.500", "1.45.000", "1,2,3", "1.450,5.0", "12.", "12,", "-5", "1e5", "0.500", "1..000", "1.450.00", ".5", "9999999999999"]) bad(text);
  });
  it("moneyState maps invalid text to a value Number() rejects", () => {
    assert.equal(moneyState("1.450.000"), "1450000");
    assert.equal(moneyState("abc"), MONEY_INVALID);
    assert.ok(Number.isNaN(Number(MONEY_INVALID)));
  });
  it("leaves an unedited price alone", () => {
    assert.equal(moneyState(String(350000.5)), "350000.5");
  });
});
