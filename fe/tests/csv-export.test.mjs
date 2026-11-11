// Run: node --test tests/csv-export.test.mjs   (from fe/)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  csvFilename,
  customerCsvQuery,
  filenameFromDisposition,
  orderCsvQuery,
  personalDataNotice,
  productCsvQuery,
  stockCsvQuery,
} from "../src/lib/admin-csv.ts";

const params = (query) => new URLSearchParams(query);

describe("CSV queries keep the live-search filters", () => {
  it("products carry keyword, category and status", () => {
    const q = params(productCsvQuery({ keyword: "  Áo   sơ mi ", categoryId: "3", status: "ACTIVE" }));
    assert.equal(q.get("keyword"), "Áo sơ mi");
    assert.equal(q.get("categoryId"), "3");
    assert.equal(q.get("status"), "ACTIVE");
  });

  it("products omit blank filters and cap the keyword", () => {
    const q = params(productCsvQuery({ keyword: "", categoryId: "", status: "" }));
    assert.deepEqual([...q.keys()], []);
    const long = "a".repeat(150);
    assert.equal(params(productCsvQuery({ keyword: long })).get("keyword").length, 100);
  });

  it("stock carries the search term only", () => {
    const q = params(stockCsvQuery({ keyword: "893850" }));
    assert.equal(q.get("keyword"), "893850");
    assert.equal(stockCsvQuery({ keyword: "" }), "");
  });

  it("orders carry keyword and status", () => {
    const q = params(orderCsvQuery({ keyword: "DH-2026", status: "SHIPPING" }));
    assert.equal(q.get("keyword"), "DH-2026");
    assert.equal(q.get("status"), "SHIPPING");
  });

  it("orders carry the created-date range as startDate and endDate", () => {
    const q = params(orderCsvQuery({ status: "COMPLETED", from: "2026-11-01", to: "2026-11-08" }));
    assert.equal(q.get("startDate"), "2026-11-01");
    assert.equal(q.get("endDate"), "2026-11-08");
    assert.equal(params(orderCsvQuery({ keyword: "a" })).has("startDate"), false);
  });

  it("customers carry the search term", () => {
    assert.equal(params(customerCsvQuery({ keyword: "Nguyễn" })).get("keyword"), "Nguyễn");
  });
});

describe("CSV file name and headers", () => {
  it("names files by dataset and Vietnam date only", () => {
    assert.equal(csvFilename("products", new Date("2026-11-07T12:00:00+07:00")), "san-pham-2026-11-07.csv");
    assert.equal(csvFilename("stock", new Date("2026-11-07T12:00:00+07:00")), "ton-kho-2026-11-07.csv");
    assert.equal(csvFilename("orders", new Date("2026-11-07T12:00:00+07:00")), "don-hang-2026-11-07.csv");
    assert.equal(csvFilename("customers", new Date("2026-11-07T12:00:00+07:00")), "khach-hang-2026-11-07.csv");
  });

  it("uses Vietnam time at the UTC day boundary", () => {
    assert.equal(csvFilename("stock", new Date("2026-11-06T18:00:00Z")), "ton-kho-2026-11-07.csv");
  });

  it("reads the server file name and refuses paths", () => {
    assert.equal(filenameFromDisposition('attachment; filename="ton-kho-2026-11-07.csv"'),
      "ton-kho-2026-11-07.csv");
    assert.equal(filenameFromDisposition("attachment; filename=san-pham-2026-11-07.csv"),
      "san-pham-2026-11-07.csv");
    assert.equal(filenameFromDisposition('attachment; filename="../secret.csv"'), null);
    assert.equal(filenameFromDisposition('attachment; filename="a/b.csv"'), null);
    assert.equal(filenameFromDisposition('attachment; filename="data.txt"'), null);
    assert.equal(filenameFromDisposition(null), null);
  });
});

describe("personal-data notice", () => {
  it("is explicit for customers and orders", () => {
    assert.match(personalDataNotice("customers"), /dữ liệu cá nhân/);
    assert.match(personalDataNotice("customers"), /số điện thoại, địa chỉ và ngày sinh/);
    assert.match(personalDataNotice("orders"), /dữ liệu cá nhân/);
    assert.match(personalDataNotice("orders"), /địa chỉ giao hàng/);
  });
});

describe("admin CSV BFF", () => {
  const source = readFileSync(new URL("../src/lib/server/admin-csv.ts", import.meta.url), "utf8");

  it("uses the admin identity and the paired backend", () => {
    assert.match(source, /import\s*\{[^}]*\badminIdentity\b[^}]*\}\s*from\s*"@\/lib\/server\/admin-bff"/);
    assert.match(source, /import\s*\{[^}]*\bBE\b[^}]*\}\s*from\s*"@\/lib\/server\/admin-bff"/);
  });

  it("keeps the download headers and does not cut long exports at 12s", () => {
    assert.match(source, /content-disposition/);
    assert.match(source, /content-type/);
    assert.equal(source.includes("AbortSignal.timeout"), false);
  });

  it("has a route per dataset under /api/admin/csv", () => {
    for (const dataset of ["products", "stock", "orders", "customers"]) {
      const route = readFileSync(
        new URL(`../src/app/api/admin/csv/${dataset}/route.ts`, import.meta.url), "utf8");
      assert.match(route, /export async function GET\(request: NextRequest\)/);
      assert.match(route, /csvExport\(request, `\/api\/v1\/admin\/csv\//);
    }
  });
});
