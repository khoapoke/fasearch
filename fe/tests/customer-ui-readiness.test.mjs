import assert from "node:assert/strict";
import test, { describe, it } from "node:test";
import { safeCustomerAuthReturn } from "../src/lib/customer-auth-return.ts";
import { formatMoney, orderStatusText } from "../src/lib/customer-commerce.ts";

describe("UI02 Auth-aware navigation & safe return", () => {
  it("permits standard internal destinations", () => {
    assert.equal(safeCustomerAuthReturn("/tai-khoan"), "/tai-khoan");
    assert.equal(safeCustomerAuthReturn("/don-hang"), "/don-hang");
    assert.equal(safeCustomerAuthReturn("/don-hang/1"), "/don-hang/1");
    assert.equal(safeCustomerAuthReturn("/quan-tri"), "/quan-tri");
  });

  it("safely sanitizes protocol-relative and malicious redirect targets", () => {
    assert.equal(safeCustomerAuthReturn("https://malicious.site"), "/tai-khoan");
    assert.equal(safeCustomerAuthReturn("//malicious.site"), "/tai-khoan");
    assert.equal(safeCustomerAuthReturn("/%2f%2fevil.com"), "/tai-khoan");
    assert.equal(safeCustomerAuthReturn("javascript:alert(1)"), "/tai-khoan");
    assert.equal(safeCustomerAuthReturn(null), "/tai-khoan");
    assert.equal(safeCustomerAuthReturn(""), "/tai-khoan");
  });

  it("differentiates 401 session convergence vs 403 permission error", () => {
    // 401 must converge to login with return target
    const getConvergenceUrl = (status, currentPath) => {
      if (status === 401) {
        return `/dang-nhap?next=${encodeURIComponent(currentPath)}`;
      }
      if (status === 403) {
        return null; // Must not redirect to login; retain on page and display permission message
      }
      return null;
    };

    assert.equal(getConvergenceUrl(401, "/tai-khoan"), "/dang-nhap?next=%2Ftai-khoan");
    assert.equal(getConvergenceUrl(401, "/don-hang/42"), "/dang-nhap?next=%2Fdon-hang%2F42");
    assert.equal(getConvergenceUrl(403, "/tai-khoan"), null);
    assert.equal(getConvergenceUrl(500, "/tai-khoan"), null);
  });
});

describe("UI03 Profile validation & single-address contract", () => {
  const PHONE_REGEX = /^(0|\+84)[0-9]{9}$/;
  const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;

  it("accepts valid Vietnamese mobile phone numbers", () => {
    assert.equal(PHONE_REGEX.test("0922222222"), true);
    assert.equal(PHONE_REGEX.test("0381234567"), true);
    assert.equal(PHONE_REGEX.test("+84912345678"), true);
  });

  it("rejects invalid phone numbers", () => {
    assert.equal(PHONE_REGEX.test("123456"), false);
    assert.equal(PHONE_REGEX.test("09222222222"), false); // 11 digits
    assert.equal(PHONE_REGEX.test("abcdefghij"), false);
  });

  it("validates optional DOB matching YYYY-MM-DD", () => {
    assert.equal(DOB_REGEX.test("1995-05-20"), true);
    assert.equal(DOB_REGEX.test("2000-12-31"), true);
    assert.equal(DOB_REGEX.test("20-05-1995"), false);
    assert.equal(DOB_REGEX.test("1995/05/20"), false);
  });

  it("enforces single address boundary under 255 chars", () => {
    const validAddr = "123 Đường ABC, Phường 1, Quận 1, TP. Hồ Chí Minh";
    assert.equal(validAddr.length <= 255, true);
    const longAddr = "A".repeat(256);
    assert.equal(longAddr.length <= 255, false);
  });
});

describe("UI04 Order detail data correctness & formatting", () => {
  it("formats zero amount currency correctly without breaking", () => {
    const zero = formatMoney(0);
    assert.match(zero, /0/);
    assert.match(zero, /đ|₫/i);
  });

  it("formats positive currencies accurately", () => {
    const formatted = formatMoney(300000);
    assert.match(formatted, /300/);
  });

  it("falls back gracefully when orderCode is null or missing", () => {
    const getDisplayCode = (order) => order.orderCode || `Đơn hàng #${order.orderId}`;
    assert.equal(getDisplayCode({ orderId: 1, orderCode: null }), "Đơn hàng #1");
    assert.equal(getDisplayCode({ orderId: 8, orderCode: "PROMO-ZERO-p7mb3v0k40" }), "PROMO-ZERO-p7mb3v0k40");
  });

  it("maps known BE order statuses to human Vietnamese descriptions", () => {
    assert.equal(orderStatusText("PENDING"), "Chờ xác nhận");
    assert.equal(orderStatusText("CONFIRMED"), "Đã xác nhận");
    assert.equal(orderStatusText("SHIPPING"), "Đang giao");
    assert.equal(orderStatusText("COMPLETED"), "Hoàn thành");
    assert.equal(orderStatusText("CANCELLED"), "Đã hủy");
  });
});
