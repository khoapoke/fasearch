import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

describe("nhãn vai trò (role-manager)", () => {
  it("ADMIN = Quản trị viên, STAFF = Quản lý, CUSTOMER = Khách hàng", async () => {
    const { roleLabel } = await import("../src/lib/admin-people-client.ts");
    assert.equal(roleLabel("ADMIN"), "Quản trị viên");
    assert.equal(roleLabel("STAFF"), "Quản lý");
    assert.equal(roleLabel("CUSTOMER"), "Khách hàng");
    assert.equal(roleLabel(null), "—");
  });

  it("canManage: Quản trị viên và Quản lý dùng nghiệp vụ, khách thì không", async () => {
    const { canManage } = await import("../src/lib/admin-roles.ts");
    assert.equal(canManage("ADMIN"), true);
    assert.equal(canManage("STAFF"), true);
    assert.equal(canManage("CUSTOMER"), false);
    assert.equal(canManage(null), false);
  });

  it("chỉ mục tài khoản nội bộ là ADMIN-only trong Admin B; Nhân sự hiển thị cho Quản lý", () => {
    // Khung điều hướng nằm ở AdminFrame (layout bền vững), AdminShellB chỉ còn công bố tiêu đề.
    const shell = read("src/components/admin-b/admin-frame.tsx");
    assert.match(shell, /const adminOnly = \["\/quan-tri\/tai-khoan-noi-bo"\]/);
    // Nhân sự: không adminOnly, chỉ ẩn khi Quản lý bị tắt quyền xem hồ sơ nhân sự (O1).
    assert.match(shell, /label: "Nhân sự", icon: "user-cog", perm: "EMPLOYEE_VIEW"\s*\}/);
    assert.doesNotMatch(shell, /Nhân viên/);
    assert.match(shell, /href: "\/quan-tri\/tai-khoan-noi-bo"[^\n]*adminOnly: true/);
    assert.match(shell, /!item\.adminOnly \|\| role === "ADMIN"/);
  });

  it("BFF tài khoản vẫn chặn Quản lý; BFF hồ sơ nhân sự và nghiệp vụ không còn khóa ADMIN", () => {
    const people = read("src/lib/server/admin-people.ts");
    assert.match(people, /adminOnly && who\.identity\.role !== "ADMIN"/);
    assert.match(people, /current\.role !== "ADMIN" && checked\.body\.accountId !== undefined/);
    for (const f of ["src/lib/server/admin-catalog.ts", "src/lib/server/admin-stock.ts", "src/lib/server/promotions-bff.ts"]) {
      assert.doesNotMatch(read(f), /identity\.role !== "ADMIN"/, f);
    }
  });
});
