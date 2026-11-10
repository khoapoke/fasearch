// Shared catalog contract consumer: server/local param separation.
// Run: node --test tests/catalog-contract.test.mjs   (from the fe/ directory)

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  catalogQueryString,
  facetsQueryString,
  probeCatalogCaps,
  resetCatalogCaps,
} from "../src/lib/catalog.ts";

const BASE = { q: "", maDanhMuc: "", giaTu: "", giaDen: "", kichCo: "", mauSac: "", sapXep: "", page: 0, size: 24 };

describe("catalogQueryString", () => {
  it("local mode không rò rỉ kichCo/mauSac/sapXep (BE cũ lờ tham số lạ)", () => {
    const qs = catalogQueryString({ ...BASE, kichCo: "L", mauSac: "Đen", sapXep: "price-asc" }, false);
    assert.ok(!qs.includes("kichCo="), qs);
    assert.ok(!qs.includes("mauSac="), qs);
    assert.ok(!qs.includes("sapXep="), qs);
    assert.ok(qs.includes("size=24"), qs);
  });

  it("server mode gửi đủ kichCo/mauSac/sapXep + base filters", () => {
    const qs = catalogQueryString(
      { ...BASE, maDanhMuc: "2", giaTu: "200000", giaDen: "350000", kichCo: "30", mauSac: "Xanh đậm", sapXep: "price-asc", page: 2 },
      true,
    );
    for (const part of ["maDanhMuc=2", "giaTu=200000", "giaDen=350000", "page=2"]) {
      assert.ok(qs.includes(part), qs);
    }
    const parsed = new URLSearchParams(qs);
    assert.equal(parsed.get("kichCo"), "30");
    assert.equal(parsed.get("mauSac"), "Xanh đậm");
    assert.equal(parsed.get("sapXep"), "price-asc");
  });

  it("numeric 30/31 sizes đi nguyên văn, không ép chữ", () => {
    const parsed = new URLSearchParams(catalogQueryString({ ...BASE, kichCo: "31" }, true));
    assert.equal(parsed.get("kichCo"), "31");
  });
});

describe("facetsQueryString", () => {
  it("chỉ mang base filter, không mang size/color đã chọn", () => {
    const qs = facetsQueryString({ q: "jean", maDanhMuc: "2", giaTu: "0", giaDen: "" });
    assert.ok(qs.includes("maDanhMuc=2"), qs);
    assert.ok(!qs.includes("kichCo"), qs);
    assert.ok(!qs.includes("mauSac"), qs);
  });
});

describe("probeCatalogCaps", () => {
  beforeEach(() => resetCatalogCaps());

  it("bo-loc 404 → local mode (không suy capability từ list 200)", async () => {
    globalThis.fetch = async () => new Response("not found", { status: 404 });
    try {
      const caps = await probeCatalogCaps();
      assert.equal(caps.server, false);
      assert.equal(caps.facets, null);
    } finally {
      // @ts-expect-error restore later by next test setup
      delete globalThis.fetch;
    }
  });

  it("bo-loc 200 đúng shape → server mode + facets thật", async () => {
    const facets = { mauSac: ["Xanh đậm", "Đen"], kichCo: ["30", "31", "M"], truncated: false };
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ success: true, code: 200, message: "ok", result: facets }), { status: 200 });
    try {
      const caps = await probeCatalogCaps();
      assert.equal(caps.server, true);
      assert.deepEqual(caps.facets?.kichCo, ["30", "31", "M"]);
    } finally {
      // @ts-expect-error restore
      delete globalThis.fetch;
    }
  });

  it("bo-loc 200 sai shape → local mode", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ success: true, code: 200, result: { foo: 1 } }), { status: 200 });
    try {
      const caps = await probeCatalogCaps();
      assert.equal(caps.server, false);
    } finally {
      // @ts-expect-error restore
      delete globalThis.fetch;
    }
  });
});

describe("dedupeFacetValues", () => {
  it("gộp màu trùng khác dấu/chữ hoa, giữ giá trị có dấu", async () => {
    const { dedupeFacetValues } = await import("../src/lib/catalog.ts");
    assert.deepEqual(dedupeFacetValues(["DEN", "Đen", "Trắng", "TRANG"]), ["Đen", "Trắng"]);
  });
  it("bỏ giá trị rỗng, giữ thứ tự server", async () => {
    const { dedupeFacetValues } = await import("../src/lib/catalog.ts");
    assert.deepEqual(dedupeFacetValues(["", "  ", "Xanh", "Đỏ"]), ["Xanh", "Đỏ"]);
  });
  it("không gộp màu khác nhau", async () => {
    const { dedupeFacetValues } = await import("../src/lib/catalog.ts");
    assert.deepEqual(dedupeFacetValues(["Be", "Kem"]), ["Be", "Kem"]);
  });
});
