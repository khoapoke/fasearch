// Run: node --test tests/csv-import.test.mjs   (from fe/)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  IMPORT_MAX_FILE_BYTES,
  canApplyCsv,
  draftHref,
  fileFingerprint,
  importSummary,
  pagedImportErrors,
  precheckCsvFile,
} from "../src/lib/admin-csv-import.ts";

const clean = (overrides = {}) => ({
  checksum: "a".repeat(64),
  totalRows: 3,
  validRows: 3,
  productCount: 3,
  errorCount: 0,
  truncated: false,
  errors: [],
  drafts: [],
  ...overrides,
});

const sourceOf = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("CSV import file pre-checks", () => {
  it("accepts a normal CSV and the Excel content types", () => {
    assert.equal(precheckCsvFile({ name: "san-pham.csv", size: 1200, type: "text/csv" }), null);
    assert.equal(precheckCsvFile({ name: "a.csv", size: 1, type: "" }), null);
    assert.equal(precheckCsvFile({ name: "a.csv", size: 1, type: "application/vnd.ms-excel" }), null);
    assert.equal(precheckCsvFile({ name: "a.csv", size: 1, type: "text/plain" }), null);
  });

  it("refuses the wrong extension, an empty file, a non-CSV type and oversize", () => {
    assert.match(precheckCsvFile({ name: "a.txt", size: 10, type: "text/csv" }), /\.csv/);
    assert.match(precheckCsvFile({ name: "a.csv", size: 0, type: "text/csv" }), /trống/);
    assert.match(precheckCsvFile({ name: "a.csv", size: 10, type: "application/pdf" }), /CSV/);
    assert.match(
      precheckCsvFile({ name: "a.csv", size: IMPORT_MAX_FILE_BYTES + 1, type: "text/csv" }),
      /5 MB/,
    );
  });

  it("fingerprints name, size and modification time", () => {
    const base = { name: "a.csv", size: 10, lastModified: 1000 };
    assert.equal(fileFingerprint(base), "a.csv|10|1000");
    assert.notEqual(fileFingerprint(base), fileFingerprint({ ...base, size: 11 }));
    assert.notEqual(fileFingerprint(base), fileFingerprint({ ...base, lastModified: 1001 }));
  });
});

describe("the apply guard", () => {
  it("needs a clean result for the same file", () => {
    assert.equal(canApplyCsv(clean(), "a.csv|10|1", "a.csv|10|1"), true);
    assert.equal(canApplyCsv(clean(), "a.csv|10|1", "a.csv|10|2"), false);
    assert.equal(canApplyCsv(clean(), "", ""), false);
    assert.equal(canApplyCsv(null, "a.csv|10|1", "a.csv|10|1"), false);
  });

  it("refuses a result with any error or a malformed checksum", () => {
    assert.equal(canApplyCsv(clean({ errorCount: 1 }), "f", "f"), false);
    assert.equal(canApplyCsv(clean({ checksum: "short" }), "f", "f"), false);
  });
});

describe("error table pagination", () => {
  const errors = Array.from({ length: 45 }, (_, index) => ({
    row: index + 2,
    column: "Giá bán",
    code: "INVALID_NUMBER",
    message: "Giá bán phải là số không âm.",
  }));

  it("splits errors into 20-row pages and clamps the page", () => {
    const first = pagedImportErrors(errors, 0);
    assert.equal(first.rows.length, 20);
    assert.equal(first.totalPages, 3);
    assert.equal(first.page, 0);

    const last = pagedImportErrors(errors, 2);
    assert.equal(last.rows.length, 5);
    assert.equal(last.rows[0].row, 42);

    const clamped = pagedImportErrors(errors, 99);
    assert.equal(clamped.page, 2);
    assert.equal(pagedImportErrors(errors, -3).page, 0);
  });
});

describe("import summary and draft links", () => {
  it("shows counts and errors", () => {
    assert.match(importSummary(clean()), /3 dòng · 3 hợp lệ · 3 sản phẩm · không có lỗi/);
    assert.match(importSummary(clean({ errorCount: 2 })), /2 lỗi/);
  });

  it("opens created drafts in the existing draft screen", () => {
    assert.equal(draftHref(42), "/quan-tri/san-pham/nhap/42");
  });
});

describe("CSV import BFF", () => {
  const source = sourceOf("../src/app/api/admin/csv/products/import/route.ts");

  it("checks the admin identity and requires multipart", () => {
    assert.match(source, /adminIdentity/);
    assert.match(source, /authCookie/);
    assert.match(source, /multipart\/form-data/);
  });

  it("caps the body before forwarding and allows more than 12 seconds", () => {
    assert.match(source, /MAX_BODY_BYTES = 6 \* 1024 \* 1024/);
    assert.match(source, /413/);
    assert.match(source, /120_000/);
    assert.equal(source.includes("AbortSignal.timeout(12000)"), false);
  });

  it("forwards dry run and the apply checksum to the backend path", () => {
    assert.match(source, /\/api\/v1\/admin\/csv\/products\/import/);
    assert.match(source, /dryRun/);
    assert.match(source, /checksum/);
  });

  it("has a template route with the admin guard", () => {
    const template = sourceOf("../src/app/api/admin/csv/products/template/route.ts");
    assert.match(template, /adminIdentity/);
    assert.match(template, /\/api\/v1\/admin\/csv\/products\/template/);
    assert.match(template, /content-disposition/);
  });
});

describe("CSV import screen", () => {
  const page = sourceOf("../src/app/quan-tri/san-pham/nhap-csv/page.tsx");

  it("offers the template, a dry run and the guarded apply", () => {
    assert.match(page, /Tải tệp mẫu/);
    assert.match(page, /Kiểm tra/);
    assert.match(page, /canApplyCsv/);
    assert.match(page, /CSV_IMPORT_TEMPLATE_URL/);
    assert.match(page, /dryRunCsvImport/);
    assert.match(page, /applyCsvImport/);
  });

  it("says the result is drafts, not published and without stock", () => {
    assert.match(page, /chưa Publish/i);
    assert.match(page, /không nhập tồn kho/i);
    assert.match(page, /phiếu nhập/);
  });

  it("links drafts through the shared draft helper and has a paged error table", () => {
    assert.match(page, /draftHref/);
    assert.match(page, /pagedImportErrors/);
    assert.match(page, /<th className="num">Dòng<\/th><th>Cột<\/th><th>Lỗi<\/th>/);
    assert.match(page, /truncated/);
  });

  it("is reachable from the product list", () => {
    const list = sourceOf("../src/app/quan-tri/san-pham/products-client.tsx");
    assert.match(list, /Import CSV/);
    assert.match(list, /\/quan-tri\/san-pham\/nhap-csv/);
  });
});
