import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  cartStockAlertText,
  cartUnitForCategory,
  isStockShortageFailure,
  remainingForSku,
} from "../src/lib/pdp-cart-stock.ts";
import { CommerceError, STOCK_OUT_MESSAGE } from "../src/lib/customer-commerce.ts";

describe("PDP cart-stock helpers (Part B)", () => {
  test("unit is pairs only for shoes", () => {
    assert.equal(cartUnitForCategory("Giày"), "đôi");
    assert.equal(cartUnitForCategory("Giày thể thao"), "đôi");
    assert.equal(cartUnitForCategory("Áo"), "sản phẩm");
    assert.equal(cartUnitForCategory(null), "sản phẩm");
    assert.equal(cartUnitForCategory(undefined), "sản phẩm");
  });

  test("remaining clamps and stays unknown without stock", () => {
    assert.equal(remainingForSku(6, 6), 0);
    assert.equal(remainingForSku(6, 2), 4);
    assert.equal(remainingForSku(0, 0), 0);
    assert.equal(remainingForSku(null, 0), null);
    assert.equal(remainingForSku(undefined, 3), null);
  });

  test("detects only the normalized stock-shortage messages", () => {
    assert.equal(isStockShortageFailure(new CommerceError(STOCK_OUT_MESSAGE, 400)), true);
    assert.equal(
      isStockShortageFailure(new CommerceError("Chỉ còn 2 sản phẩm cho lựa chọn này — bạn giảm số lượng rồi thử lại nhé.", 400)),
      true,
    );
    // Mã tên INSUFFICIENT_STOCK (BE envelope ErrorCode chuẩn).
    assert.equal(isStockShortageFailure(new CommerceError("Hết hàng", 400, "INSUFFICIENT_STOCK")), true);
    assert.equal(isStockShortageFailure(new CommerceError("INSUFFICIENT_STOCK", 400)), true);
    assert.equal(isStockShortageFailure(new CommerceError("Không thêm được vào giỏ. Thử lại.", 400)), false);
    assert.equal(isStockShortageFailure(new Error("boom")), false);
    assert.equal(isStockShortageFailure(null), false);
  });

  test("remaining goes negative when the cart already holds everything", () => {
    assert.equal(remainingForSku(6, 7), -1);
    assert.equal(remainingForSku(4, 4), 0);
  });

  test("alert text names size, stock and the full cart", () => {
    assert.equal(
      cartStockAlertText({ size: "41", available: 6, inCart: 6, unit: "đôi" }),
      "Size 41 chỉ còn 6 đôi và giỏ của bạn đã có đủ 6 rồi.",
    );
    assert.equal(
      cartStockAlertText({ size: "M", available: 2, inCart: 2, unit: "sản phẩm" }),
      "Size M chỉ còn 2 sản phẩm và giỏ của bạn đã có đủ 2 rồi.",
    );
    assert.equal(
      cartStockAlertText({ size: "41", available: 6, inCart: 2, unit: "đôi" }),
      "Size 41 chỉ còn 6 đôi — bạn giảm số lượng rồi thử lại nhé.",
    );
    assert.equal(
      cartStockAlertText({ size: null, available: 1, inCart: 1, unit: "sản phẩm" }),
      "Lựa chọn này chỉ còn 1 sản phẩm và giỏ của bạn đã có đủ 1 rồi.",
    );
  });
});
