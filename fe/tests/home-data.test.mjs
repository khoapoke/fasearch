// Run: node --test tests/home-data.test.mjs (from fe/)
//
// Chặn hồi quy cho ranh giới dữ liệu Home (A2): năm trạng thái phải phân biệt
// được, fixture không được trộn với dữ liệu shop thật, và demo giữ đúng ba bước.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HOME_DEMO,
  HOME_DEMO_STEPS,
  HOME_PHOTOS,
  homeDiscoveryState,
} from "../src/app/home-data.ts";

const cats = [{ id: 3, name: "Áo Thun" }, { id: 4, name: "Quần Jean" }];
const product = { id: 1, name: "Áo Thun Cổ Tròn Basic", price: 150000, href: "/san-pham/1" };

describe("trạng thái khám phá của Home", () => {
  it("chưa có dữ liệu -> loading", () => {
    assert.deepEqual(
      homeDiscoveryState({ categories: null, categoriesError: null, products: null, productsTotal: null, productsError: null }),
      { status: "loading" },
    );
  });

  it("danh mục lỗi và chưa có sản phẩm -> error (không bịa dữ liệu)", () => {
    const s = homeDiscoveryState({
      categories: null, categoriesError: "Không tải được danh mục.",
      products: null, productsTotal: null, productsError: null,
    });
    assert.equal(s.status, "error");
    assert.match(s.message, /danh mục/);
  });

  it("sản phẩm lỗi nhưng danh mục có -> partial", () => {
    const s = homeDiscoveryState({
      categories: cats, categoriesError: null,
      products: null, productsTotal: null, productsError: "Không tải được sản phẩm. Vui lòng thử lại.",
    });
    assert.equal(s.status, "partial");
    assert.equal(s.categories.length, 2);
    assert.match(s.productError, /sản phẩm/);
  });

  it("sản phẩm lỗi và danh mục cũng không có -> error", () => {
    const s = homeDiscoveryState({
      categories: null, categoriesError: null,
      products: null, productsTotal: null, productsError: "Không tải được sản phẩm.",
    });
    assert.equal(s.status, "error");
  });

  it("máy chủ trả 0 sản phẩm -> empty (khác với lỗi)", () => {
    const s = homeDiscoveryState({
      categories: cats, categoriesError: null,
      products: [], productsTotal: 0, productsError: null,
    });
    assert.equal(s.status, "empty");
    assert.equal(s.categories.length, 2);
  });

  it("có sản phẩm -> ready kèm tổng số", () => {
    const s = homeDiscoveryState({
      categories: cats, categoriesError: null,
      products: [product], productsTotal: 12, productsError: null,
    });
    assert.equal(s.status, "ready");
    assert.equal(s.total, 12);
    assert.equal(s.products[0].name, "Áo Thun Cổ Tròn Basic");
  });

  it("danh mục về trước, sản phẩm còn tải -> vẫn loading (không nhấp nháy)", () => {
    assert.equal(
      homeDiscoveryState({
        categories: cats, categoriesError: null,
        products: null, productsTotal: null, productsError: null,
      }).status,
      "loading",
    );
  });
});

describe("ranh giới fixture của demo", () => {
  it("fixture KHÔNG có mã sản phẩm/đường dẫn mua (không phải sản phẩm thật)", () => {
    const p = HOME_DEMO.product;
    assert.equal("id" in p, false);
    assert.equal("maSp" in p, false);
    assert.equal("href" in p, false);
    assert.equal("slug" in p, false);
  });

  it("giá là chuỗi minh họa đã định dạng, không phải số để tính toán", () => {
    assert.equal(typeof HOME_DEMO.product.priceLabel, "string");
    assert.match(HOME_DEMO.product.priceLabel, /549\.000/);
  });

  it("có disclosure nói rõ đây là minh họa, không bán được", () => {
    assert.match(HOME_DEMO.disclosure, /minh họa/i);
    assert.match(HOME_DEMO.disclosure, /không phải giá bán/i);
  });

  it("demo có đúng ba bước theo thứ tự Mô tả → Gợi ý → Xem món đồ", () => {
    assert.deepEqual(HOME_DEMO_STEPS.map((s) => s.id), ["describe", "suggest", "explore"]);
    assert.deepEqual(HOME_DEMO_STEPS.map((s) => s.label), ["Mô tả", "Gợi ý", "Xem món đồ"]);
  });

  it("ảnh giữ credit và nguồn gốc (provenance)", () => {
    for (const photo of Object.values(HOME_PHOTOS)) {
      assert.match(photo.page, /^https:\/\/unsplash\.com\//);
      assert.match(photo.sourceLabel, /Unsplash/);
      assert.ok(photo.author.length > 0);
      assert.ok(photo.alt.length > 20, "alt phải mô tả được ảnh");
    }
  });
});
