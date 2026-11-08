// Helpers tìm chữ AI: validation bounds + bóc envelope giữ thứ tự upstream.
// Run: node --test tests/ai-search.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAiResults, toCatalogImageUrl, validateLimit, validateQuery } from "../src/lib/ai-search.ts";
import { colorSwatch } from "../src/lib/color-swatch.ts";

function envelope(results) {
  return { success: true, code: 200, message: "ok", result: { results } };
}

describe("validateQuery", () => {
  it("giữ nguyên chữ gốc sau khi strip", () => {
    assert.equal(validateQuery("  black shirt  "), "black shirt");
  });

  it("rỗng/sai sau strip → 400 VI", () => {
    assert.throws(() => validateQuery("   "), /1–200/);
  });

  it("quá 200 codepoints → lỗi", () => {
    assert.throws(() => validateQuery("a".repeat(201)), /200/);
    assert.equal(validateQuery("a".repeat(200)).length, 200);
  });
});

describe("validateLimit", () => {
  it("trống → default 12", () => {
    assert.equal(validateLimit(""), 12);
  });

  it("1..24 hợp lệ", () => {
    assert.equal(validateLimit("1"), 1);
    assert.equal(validateLimit("24"), 24);
  });

  it("0/6/thập phân/chữ → lỗi", () => {
    assert.throws(() => validateLimit("0"), /1–24/);
    assert.throws(() => validateLimit("25"), /1–24/);
    assert.throws(() => validateLimit("2.5"), /1–24/);
    assert.throws(() => validateLimit("abc"), /1–24/);
  });
});

const hit = (over = {}) => ({
  sourceId: "p1", score: 0.42, productId: 7, name: "Áo thun trắng", brandName: "Davies", price: 199000,
  imageUrl: "/api/catalog/product-images/abc.jpg", colors: ["Trắng", "Đen"], ...over,
});

describe("parseAiResults (sản phẩm thật đang bán)", () => {
  it("bóc dữ liệu thẻ sản phẩm, giữ thứ tự upstream", () => {
    const hits = parseAiResults(envelope([hit(), hit({ sourceId: "p2", productId: 8, name: "Quần jean", brandName: null, imageUrl: null, colors: [] })]));
    assert.deepEqual(hits.map((h) => h.productId), [7, 8]);
    assert.deepEqual(hits[0], { sourceId: "p1", score: 0.42, productId: 7, name: "Áo thun trắng", brandName: "Davies", price: 199000, imageUrl: "/api/catalog/product-images/abc.jpg", colors: ["Trắng", "Đen"] });
    assert.equal(hits[1].brandName, null);
    assert.equal(hits[1].imageUrl, null);
  });

  it("không lộ nhãn kỹ thuật dataset/seed", () => {
    const [h] = parseAiResults(envelope([{ ...hit(), fileName: "seed-1.jpg", catalog: "dataset", nguonDuLieu: "AI dataset" }]));
    for (const k of ["fileName", "catalog", "nguonDuLieu", "phienBanDuLieu", "tenHienThi", "maSpLienKet"]) assert.equal(k in h, false);
  });

  it("results=[] rỗng là success hợp lệ", () => {
    assert.deepEqual(parseAiResults(envelope([])), []);
  });

  it("score không hữu hạn/thiếu id → lỗi định dạng", () => {
    assert.throws(() => parseAiResults(envelope([hit({ score: NaN })])), /điểm số/);
    assert.throws(() => parseAiResults(envelope([hit({ sourceId: "" })])), /định dạng/);
  });

  it("thiếu productId/tên/giá → lỗi định dạng (không hiển thị kết quả không phải sản phẩm)", () => {
    assert.throws(() => parseAiResults(envelope([hit({ productId: null })])), /định dạng/);
    assert.throws(() => parseAiResults(envelope([hit({ productId: 0 })])), /định dạng/);
    assert.throws(() => parseAiResults(envelope([hit({ name: "  " })])), /định dạng/);
    assert.throws(() => parseAiResults(envelope([hit({ price: undefined })])), /định dạng/);
  });

  it("thiếu results → lỗi định dạng", () => {
    assert.throws(() => parseAiResults({ success: true, result: {} }), /định dạng/);
  });

  it("imageUrl lạ/bên ngoài/traversal → null", () => {
    const hits = parseAiResults(envelope([
      hit({ imageUrl: "https://evil.test/x.jpg" }),
      hit({ imageUrl: "/api/ai/image?path=%2Fapi%2Fv1%2Fsearch%2Fimages%2Fa.jpg" }),
      hit({ imageUrl: "/api/catalog/product-images/../secret" }),
      hit({ imageUrl: "/api/catalog/product-images/" }),
    ]));
    for (const h of hits) assert.equal(h.imageUrl, null);
  });
});

describe("toCatalogImageUrl", () => {
  it("chỉ nhận ảnh sản phẩm catalog qua BFF cùng origin", () => {
    assert.equal(toCatalogImageUrl("/api/catalog/product-images/abc-1.jpg"), "/api/catalog/product-images/abc-1.jpg");
    assert.equal(toCatalogImageUrl("//evil.test/x"), null);
    assert.equal(toCatalogImageUrl(null), null);
    assert.equal(toCatalogImageUrl(42), null);
  });
});

describe("colorSwatch", () => {
  it("nhận tên màu VI/EN, null khi không nhận ra", () => {
    assert.equal(colorSwatch("Đen"), "#1c1c1e");
    assert.equal(colorSwatch("White"), "#f5f5f4");
    assert.equal(colorSwatch("Xanh đen"), "#22364f");
    assert.equal(colorSwatch("Xanh rêu"), "#5b6b5c");
    assert.equal(colorSwatch("Họa tiết lạ"), null);
    assert.equal(colorSwatch(""), null);
  });
});
