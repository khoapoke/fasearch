// Account return allowlist + client validation mirrors (server authoritative).
// Run: node --test tests/account-contract.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  safeAccountReturnHref,
  validateUsernameInput,
  validateEmailInput,
  validateNewPasswordInput,
} from "../src/lib/account-contract.ts";

describe("safeAccountReturnHref", () => {
  it("falls back for missing, external, or protocol-relative targets", () => {
    assert.equal(safeAccountReturnHref(null), "/tai-khoan");
    assert.equal(safeAccountReturnHref(""), "/tai-khoan");
    assert.equal(safeAccountReturnHref("https://evil.test/x"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("//evil.test/x"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/\\evil"), "/tai-khoan");
  });

  it("rejects dot-dot traversal including encoded variants", () => {
    assert.equal(safeAccountReturnHref("/tai-khoan/../dang-nhap"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/tai-khoan/%2e%2e/x"), "/tai-khoan");
  });

  it("keeps only real slice routes", () => {
    assert.equal(safeAccountReturnHref("/tai-khoan/thong-tin"), "/tai-khoan/thong-tin");
    assert.equal(safeAccountReturnHref("/tim-kiem-ai"), "/tim-kiem-ai");
    assert.equal(safeAccountReturnHref("/tim-kiem-ai?x=1"), "/tim-kiem-ai?x=1");
    assert.equal(safeAccountReturnHref("/"), "/");
    assert.equal(safeAccountReturnHref("/catalog"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/search/text"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/dang-ky"), "/tai-khoan");
    assert.equal(safeAccountReturnHref("/quan-tri/khuyen-mai"), "/quan-tri/khuyen-mai");
    assert.equal(safeAccountReturnHref("/quan-tri"), "/quan-tri");
  });
});

describe("validateUsernameInput", () => {
  it("mirrors the template VARCHAR(50) bound", () => {
    assert.equal(validateUsernameInput("nguoi_dung.01"), null);
    assert.ok(validateUsernameInput("") !== null);
    assert.ok(validateUsernameInput("a".repeat(51)) !== null);
    assert.equal(validateUsernameInput("a".repeat(50)), null);
    assert.ok(validateUsernameInput("có dấu") !== null);
  });
});

describe("validateEmailInput", () => {
  it("mirrors the template VARCHAR(100) bound", () => {
    assert.equal(validateEmailInput("nguoi01@example.test"), null);
    assert.ok(validateEmailInput("not-an-email") !== null);
    assert.ok(validateEmailInput(`${"a".repeat(95)}@x.test`) !== null);
  });
});

describe("validateNewPasswordInput", () => {
  it("accepts a compliant passphrase and rejects the rest", () => {
    assert.equal(validateNewPasswordInput("a-very-long-test-passphrase-01"), null);
    assert.ok(validateNewPasswordInput("short") !== null);
    assert.ok(validateNewPasswordInput("😀".repeat(20)) !== null);
  });
});

// Consolidated from fe/tests/customer-ui-readiness.test.mjs; audit 2026-11-07.
{
const { default: assert } = await import("node:assert/strict");
const { describe,it } = await import("node:test");
const { resolveHeaderAccountNav } = await import("../src/lib/customer-header-nav.ts");
const { formatMoney, orderStatusText } = await import("../src/lib/customer-commerce.ts");
  describe("UI-P2-CUSTOMER-HEADER-403-AS-GUEST Header nav state resolution", () => {
    it("distinguishes 401 guest from 403 forbidden and 500 server error", () => {
      const guestNav = resolveHeaderAccountNav({ status: "guest" });
      assert.equal(guestNav.label, "Đăng nhập");
      assert.equal(guestNav.href, "/dang-nhap?next=%2Ftai-khoan");
      assert.equal(guestNav.isGuest, true);
      assert.equal(guestNav.showAdminEntry, false);

      const forbiddenNav = resolveHeaderAccountNav({
        status: "forbidden",
        message: "Tài khoản không có quyền truy cập khu vực này.",
      });
      assert.equal(forbiddenNav.label, "Tài khoản");
      assert.equal(forbiddenNav.href, "/tai-khoan");
      assert.equal(forbiddenNav.isGuest, false);
      assert.equal(forbiddenNav.showAdminEntry, false);
      assert.match(forbiddenNav.title, /quyền/i);
      // Must not redirect to login or show guest login
      assert.notEqual(forbiddenNav.label, "Đăng nhập");
      assert.doesNotMatch(forbiddenNav.href, /dang-nhap/);

      const errorNav = resolveHeaderAccountNav({
        status: "error",
        message: "Không tải được tài khoản lúc này.",
      });
      assert.equal(errorNav.label, "Tài khoản");
      assert.equal(errorNav.href, "/tai-khoan");
      assert.equal(errorNav.isGuest, false);
      assert.equal(errorNav.showAdminEntry, false);
      assert.match(errorNav.title, /thử lại/i);
      // Must not redirect to login or show guest login
      assert.notEqual(errorNav.label, "Đăng nhập");
      assert.doesNotMatch(errorNav.href, /dang-nhap/);
    });

    it("handles initial and transient loading without guest flash or redirect", () => {
      const loadingNav = resolveHeaderAccountNav({ status: "loading" });
      assert.equal(loadingNav.label, "Tài khoản");
      assert.equal(loadingNav.href, "/tai-khoan");
      assert.equal(loadingNav.isGuest, false);
      assert.equal(loadingNav.showAdminEntry, false);
      assert.doesNotMatch(loadingNav.href, /dang-nhap/);
    });

    it("displays username and preserves role entry once authenticated", () => {
      const customerNav = resolveHeaderAccountNav({
        status: "authenticated",
        identity: {
          id: 10,
          username: "customer1",
          email: "customer1@example.com",
          role: "CUSTOMER",
          status: "ACTIVE",
          createdAt: "2026-01-01T00:00:00Z",
        },
      });
      assert.equal(customerNav.label, "customer1");
      assert.equal(customerNav.href, "/tai-khoan");
      assert.equal(customerNav.showAdminEntry, false);
      assert.equal(customerNav.isGuest, false);

      const adminNav = resolveHeaderAccountNav({
        status: "authenticated",
        identity: {
          id: 1,
          username: "admin",
          email: "admin@example.com",
          role: "ADMIN",
          status: "ACTIVE",
          createdAt: "2026-01-01T00:00:00Z",
        },
      });
      assert.equal(adminNav.label, "admin");
      assert.equal(adminNav.href, "/tai-khoan");
      assert.equal(adminNav.showAdminEntry, true);
      assert.equal(adminNav.isGuest, false);

      const staffNav = resolveHeaderAccountNav({
        status: "authenticated",
        identity: {
          id: 2,
          username: "staff_warehouse",
          email: "staff@example.com",
          role: "STAFF",
          status: "ACTIVE",
          createdAt: "2026-01-01T00:00:00Z",
        },
      });
      assert.equal(staffNav.label, "staff_warehouse");
      assert.equal(staffNav.showAdminEntry, true);
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


  it("maps known BE order statuses to human Vietnamese descriptions", () => {
    assert.equal(orderStatusText("PENDING"), "Chờ xác nhận");
    assert.equal(orderStatusText("CONFIRMED"), "Đã xác nhận");
    assert.equal(orderStatusText("SHIPPING"), "Đang giao");
    assert.equal(orderStatusText("COMPLETED"), "Hoàn thành");
    assert.equal(orderStatusText("CANCELLED"), "Đã hủy");
  });
});

}

// Consolidated from fe/tests/profile-draft.test.mjs; audit 2026-11-07.
{
// Profile draft keeps original ho/ten fields from the backend DTO.
// Run: node --test tests/account-contract.test.mjs   (from the fe/ directory)

const { describe, it } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const { EMPTY_DRAFT, draftFromCustomer } = await import("../src/lib/profile-draft.ts");

describe("draftFromCustomer", () => {
  it("keeps a one-word given name intact (no doubling)", () => {
    const draft = draftFromCustomer({
      ho: null,
      ten: "Bình",
      gioiTinh: null,
      ngaySinh: null,
      diaChi: null,
      email: null,
    });
    assert.equal(draft.ho, "");
    assert.equal(draft.ten, "Bình");
  });

  it("keeps multi-word name boundaries intact", () => {
    const draft = draftFromCustomer({
      ho: "Trần Minh",
      ten: "Anh",
      gioiTinh: "Nam",
      ngaySinh: "2000-01-01",
      diaChi: "1 Đường Test",
      email: "a@example.test",
    });
    assert.equal(draft.ho, "Trần Minh");
    assert.equal(draft.ten, "Anh");
    assert.equal(draft.diaChi, "1 Đường Test");
  });

  it("maps nulls to empty strings and null customer to empty draft", () => {
    const draft = draftFromCustomer({
      ho: "",
      ten: "",
      gioiTinh: null,
      ngaySinh: null,
      diaChi: null,
      email: null,
    });
    assert.deepEqual(draft, { ...EMPTY_DRAFT });
    assert.deepEqual(draftFromCustomer(null), EMPTY_DRAFT);
  });
});

}
