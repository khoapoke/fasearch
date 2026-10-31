import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const stock = readFileSync(new URL("../src/lib/server/admin-stock.ts", import.meta.url), "utf8");
const stocktake = readFileSync(new URL("../src/lib/server/admin-stocktake.ts", import.meta.url), "utf8");
const bff = readFileSync(new URL("../src/lib/server/admin-bff.ts", import.meta.url), "utf8");
describe("admin stock/stocktake upstream", () => {
  for (const [name, src] of [["admin-stock", stock], ["admin-stocktake", stocktake]]) {
    it(name + " has no stale 18122", () => assert.equal(src.includes("127.0.0.1:18122"), false));
    it(name + " imports paired BE from admin-bff", () => assert.match(src, /import\s*\{[^}]*\bBE\b[^}]*\}\s*from\s*"@\/lib\/server\/admin-bff"/));
  }
  it("admin-bff paired BE is 18126", () => assert.match(bff, /const BE = "http:\/\/127\.0\.0\.1:18126"/));
});
