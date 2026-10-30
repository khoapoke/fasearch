// Helpers tìm chữ AI: validation bounds + bóc envelope giữ thứ tự upstream.
// Run: node --test tests/ai-search.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAiResults, toProxyImageUrl, validateLimit, validateQuery } from "../src/lib/ai-search.ts";

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
  it("trống → default 5", () => {
    assert.equal(validateLimit(""), 5);
  });

  it("1..5 hợp lệ", () => {
    assert.equal(validateLimit("1"), 1);
    assert.equal(validateLimit("5"), 5);
  });

  it("0/6/thập phân/chữ → lỗi", () => {
    assert.throws(() => validateLimit("0"), /1–5/);
    assert.throws(() => validateLimit("6"), /1–5/);
    assert.throws(() => validateLimit("2.5"), /1–5/);
    assert.throws(() => validateLimit("abc"), /1–5/);
  });
});

describe("parseAiResults", () => {
  const EMPTY_META = {
    tenHienThi: null, thuocTinh: null, nguonDuLieu: null, phienBanDuLieu: null, maSpLienKet: null,
  };
  it("bóc đúng contract, giữ thứ tự, catalog null khi vắng", () => {
    const hits = parseAiResults(
      envelope([
        { sourceId: "a1", score: 0.42, fileName: "example.jpg", catalog: null },
        { sourceId: "a2", score: 0.31, fileName: "b.jpg" },
      ]),
    );
    assert.deepEqual(hits, [
      { sourceId: "a1", score: 0.42, fileName: "example.jpg", catalog: null, imageUrl: null, ...EMPTY_META },
      { sourceId: "a2", score: 0.31, fileName: "b.jpg", catalog: null, imageUrl: null, ...EMPTY_META },
    ]);
  });

  it("results=[] rỗng là success hợp lệ", () => {
    assert.deepEqual(parseAiResults(envelope([])), []);
  });

  it("alias teammate id/file_name được chấp nhận", () => {
    const hits = parseAiResults(envelope([{ id: "x", score: 0.9, file_name: "f.jpg", image_path: "/p/f.jpg", catalog: "c1" }]));
    assert.deepEqual(hits, [{ sourceId: "x", score: 0.9, fileName: "f.jpg", catalog: "c1", imageUrl: null, ...EMPTY_META }]);
  });

  it("giữ metadata mở rộng khi BE trả (không bịa khi vắng)", () => {
    const hits = parseAiResults(envelope([{
      sourceId: "s1", score: 0.7, fileName: "s1.jpg", catalog: "dataset_a",
      imageUrl: "/api/v1/ai/images/s1", tenHienThi: "Áo demo", nguonDuLieu: "dataset_a",
      phienBanDuLieu: "v1", maSpLienKet: 12,
    }]));
    assert.equal(hits[0]?.tenHienThi, "Áo demo");
    assert.equal(hits[0]?.nguonDuLieu, "dataset_a");
    assert.equal(hits[0]?.maSpLienKet, 12);
  });

  it("score NaN/Infinity/thiếu id → lỗi định dạng (không %/accuracy)", () => {
    assert.throws(() => parseAiResults(envelope([{ sourceId: "a", score: NaN, fileName: "f" }])), /điểm số/);
    assert.throws(() => parseAiResults(envelope([{ sourceId: "a", score: Infinity, fileName: "f" }])), /điểm số/);
    assert.throws(() => parseAiResults(envelope([{ score: 0.5, fileName: "f" }])), /định dạng/);
  });

  it("thiếu results → lỗi định dạng", () => {
    assert.throws(() => parseAiResults({ success: true, result: {} }), /định dạng/);
  });

  it("giữ URL ảnh từ BFF chuyên biệt, không dùng proxy catch-all đã nghỉ", () => {
    const imageUrl = `/api/ai/image?path=${encodeURIComponent("/api/v1/search/images/1008.jpg")}`;
    const hits = parseAiResults(
      envelope([{ sourceId: "1008", score: 0.26, fileName: "1008.jpg", catalog: "dataset_a", imageUrl }]),
    );
    assert.equal(hits[0]?.imageUrl, imageUrl);
    assert.equal(parseAiResults(envelope([{ sourceId: "1008", score: 0.26, fileName: "1008.jpg", imageUrl: "/api/v1/ai/images/1008" }]))[0]?.imageUrl, null);
  });

  it("imageUrl vắng → null (placeholder), không ném", () => {
    const hits = parseAiResults(envelope([{ sourceId: "a", score: 0.5, fileName: "f" }]));
    assert.equal(hits[0]?.imageUrl, null);
  });

  it("imageUrl lạ/bên ngoài/traversal → null", () => {
    const hits = parseAiResults(
      envelope([
        { sourceId: "a", score: 0.5, fileName: "f", imageUrl: "https://evil.test/x.jpg" },
        { sourceId: "b", score: 0.5, fileName: "f", imageUrl: "/api/v1/catalog/san-pham/1/hinh-anh" },
        { sourceId: "c", score: 0.5, fileName: "f", imageUrl: "/api/v1/ai/images/../secret" },
        { sourceId: "d", score: 0.5, fileName: "f", imageUrl: "/api/v1/ai/images/%2Fetc" },
        { sourceId: "e", score: 0.5, fileName: "f", imageUrl: "/api/v1/ai/images/" },
      ]),
    );
    for (const h of hits) assert.equal(h.imageUrl, null);
  });
});

describe("toProxyImageUrl", () => {
  it("chỉ chấp nhận URL same-origin từ BFF ảnh chuyên biệt", () => {
    const imageUrl = `/api/ai/image?path=${encodeURIComponent("/api/v1/search/images/1008.jpg")}`;
    assert.equal(toProxyImageUrl(imageUrl), imageUrl);
    // Các URL cũ bị loại vì /api/be catch-all trả HTTP 410.
    assert.equal(toProxyImageUrl("/api/v1/ai/images/1008"), null);
    assert.equal(toProxyImageUrl("/api/be/v1/ai/images/1008"), null);
  });

  it("từ chối ngoài/traversal/rỗng/không phải string", () => {
    assert.equal(toProxyImageUrl("https://cdn.test/a.jpg"), null);
    assert.equal(toProxyImageUrl("//evil.test/x"), null);
    assert.equal(toProxyImageUrl(`/api/ai/image?path=${encodeURIComponent("/api/v1/search/images/a/b.jpg")}`), null);
    assert.equal(toProxyImageUrl(`/api/ai/image?path=${encodeURIComponent("/api/v1/search/images/..")}`), null);
    assert.equal(toProxyImageUrl(`/api/ai/image?path=${encodeURIComponent("/api/v1/search/images/%2e%2e")}`), null);
    assert.equal(toProxyImageUrl(null), null);
    assert.equal(toProxyImageUrl(42), null);
  });
});
