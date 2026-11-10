// Trash + delete contracts for customers, employee profiles and login accounts.
// Source-level, same style as the other admin contracts.
// Run: node --test tests/trash-people-contract.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const trashPage = read("src/app/quan-tri/thung-rac/page.tsx");
const trashClient = read("src/lib/admin-trash-client.ts");
const trashBff = read("src/lib/server/admin-trash.ts");
const trashKindRoute = read("src/app/api/admin/trash/[kind]/route.ts");
const trashRestoreRoute = read("src/app/api/admin/trash/[kind]/[id]/restore/route.ts");
const deleteBff = read("src/lib/server/admin-delete.ts");
const peopleBff = read("src/lib/server/admin-people.ts");
const customerBff = read("src/lib/server/admin-customer.ts");
const customerRoute = read("src/app/api/admin/customers/[id]/route.ts");
const employeeRoute = read("src/app/api/admin/employees/[id]/route.ts");
const accountRoute = read("src/app/api/admin/accounts/[id]/route.ts");
const peopleClient = read("src/lib/admin-people-client.ts");
const customerClient = read("src/lib/admin-customer-client.ts");
const customerPage = read("src/app/quan-tri/khach-hang/[id]/page.tsx");
const employeePage = read("src/app/quan-tri/nhan-vien/[id]/page.tsx");
const accountsPage = read("src/app/quan-tri/tai-khoan-noi-bo/page.tsx");
const employeeForm = read("src/components/admin-b/employee-form.tsx");
const accountForm = read("src/components/admin-b/account-form.tsx");

describe("thùng rác: tab khách hàng, nhân sự, tài khoản", () => {
  it("có tab Khách hàng và Nhân sự cho cả ADMIN và STAFF", () => {
    for (const kind of ['"customers"', '"employees"']) assert.ok(trashPage.includes(kind), kind);
    assert.match(trashPage, /label: "Khách hàng"/);
    assert.match(trashPage, /label: "Nhân sự"/);
  });

  it("tab Tài khoản chỉ hiện với ADMIN, không liệt kê cho STAFF", () => {
    assert.match(trashPage, /kind: "accounts", label: "Tài khoản", adminOnly: true/);
    assert.match(trashPage, /useAdminRole/);
    assert.match(trashPage, /filter\(\(tab\) => !tab\.adminOnly \|\| role === "ADMIN"\)/);
  });

  it("hiển thị điện thoại khách/nhân sự và email, vai trò của tài khoản", () => {
    assert.match(trashPage, /item\.phone/);
    assert.match(trashPage, /item\.email/);
    assert.match(trashPage, /roleLabel\(item\.role\)/);
    assert.match(trashPage, /linkedAccountStatus/);
  });

  it("nói rõ khôi phục tài khoản về Ngừng hoạt động và không mở khóa hồ sơ", () => {
    assert.match(trashPage, /Ngừng hoạt động/);
    assert.match(trashPage, /không tự mở khóa/);
    assert.match(trashPage, /chưa đăng nhập được/);
  });

  it("không có nút xóa vĩnh viễn ở thùng rác", () => {
    assert.match(trashPage, /không có xóa vĩnh viễn/i);
    assert.doesNotMatch(trashPage, /purge|hard-delete|permanent/i);
  });

  it("vẫn giữ bố cục điện thoại và trạng thái rỗng", () => {
    assert.match(trashPage, /table-cards/);
    assert.match(trashPage, /Thùng rác trống/);
  });
});

describe("BFF thùng rác cho người và tài khoản", () => {
  it("nhận sáu loại dữ liệu ở cả route đọc và khôi phục", () => {
    for (const source of [trashKindRoute, trashRestoreRoute]) {
      for (const kind of ["customers", "employees", "accounts"]) assert.ok(source.includes(`"${kind}"`), kind);
    }
  });

  it("BFF từ chối STAFF ở tab tài khoản trước khi gọi BE", () => {
    assert.match(trashBff, /ADMIN_ONLY_KINDS/);
    assert.match(trashBff, /role === "ADMIN"/);
    assert.match(trashBff, /Chỉ Quản trị viên hệ thống được xem thùng rác tài khoản/);
  });

  it("model thùng rác có trường người liên kết và không có trường bí mật", () => {
    assert.match(trashClient, /linkedUsername: string \| null/);
    assert.match(trashClient, /linkedAccountStatus: string \| null/);
    assert.doesNotMatch(trashClient, /password|token|secret/i);
  });
});

describe("xóa có lý do cho khách hàng, nhân sự, tài khoản", () => {
  it("có DELETE ở cả ba route BFF", () => {
    for (const source of [customerRoute, employeeRoute, accountRoute]) assert.match(source, /export async function DELETE/);
  });

  it("xóa đi qua kiểm tra origin + JSON và gắn lý do", () => {
    assert.match(deleteBff, /requireJsonPost/);
    assert.match(deleteBff, /readJsonObject/);
    assert.match(deleteBff, /reason\.length > 255/);
    assert.match(deleteBff, /method: "DELETE"/);
  });

  it("chỉ chuyển nguyên văn thông báo guard 4401-4408, còn lại đổi sang tiếng Việt", () => {
    assert.match(deleteBff, /STAFF_GUARD = \{ min: 4401, max: 4408 \}/);
    assert.match(deleteBff, /Không tìm thấy \$\{noun\} cần xóa/);
    assert.match(deleteBff, /Không thể xóa \$\{noun\}/);
    assert.doesNotMatch(deleteBff, /upstream\.statusText/);
  });

  it("tài khoản đăng nhập là ADMIN-only ở cả BFF lẫn client", () => {
    assert.match(deleteBff, /options\.adminOnly && who\.identity\.role !== "ADMIN"/);
    assert.match(peopleBff, /accountDelete[\s\S]*adminOnly: true/);
    assert.match(customerBff, /customerDelete[\s\S]*adminOnly: false/);
    assert.match(peopleBff, /employeeDelete[\s\S]*adminOnly: false/);
  });

  it("client gửi lý do bằng JSON cho cả ba loại xóa", () => {
    for (const source of [customerClient, peopleClient]) {
      assert.match(source, /method: "DELETE"/);
      assert.match(source, /"content-type": "application\/json"/);
      assert.match(source, /JSON\.stringify\(\{ reason \}\)/);
    }
    for (const name of ["deleteCustomer", "deleteEmployee", "deleteAccount"]) {
      assert.ok(`${customerClient}${peopleClient}`.includes(name), name);
    }
  });

  it("trang khách hàng và nhân sự dùng panel xóa chung, từ chối hiển thị inline", () => {
    for (const page of [customerPage, employeePage]) {
      assert.match(page, /DeleteReasonPanel/);
      assert.match(page, /refusal=\{deleteIssue\}/);
    }
    assert.match(customerPage, /deleteCustomer\(id, reason\)/);
    assert.match(employeePage, /deleteEmployee\(employee\.id, reason\)/);
    assert.doesNotMatch(customerPage, /window\.confirm/);
    assert.doesNotMatch(employeePage, /window\.confirm/);
  });

  it("Quản lý không thấy nút xóa hồ sơ của Quản trị viên hệ thống", () => {
    assert.match(employeePage, /staffBlocked/);
    assert.match(employeePage, /employee && !staffBlocked/);
  });

  it("trang tài khoản nội bộ xóa được bằng lý do và không xóa tài khoản đang đăng nhập", () => {
    assert.match(accountsPage, /DeleteReasonPanel/);
    assert.match(accountsPage, /deleteAccount\(deleteTarget\.id, reason\)/);
    assert.match(accountsPage, /me\?\.id === a\.id \? null/);
    assert.match(accountsPage, /Ngừng hoạt động/);
  });

  it("không còn câu sai về việc không xóa được", () => {
    for (const source of [employeeForm, accountForm]) {
      assert.doesNotMatch(source, /Không xóa được hồ sơ nhân sự/);
      assert.doesNotMatch(source, /Không xóa được tài khoản/);
    }
    assert.doesNotMatch(accountsPage, /Không xóa được tài khoản\./);
    assert.match(accountsPage, /Xóa tài khoản là chuyển vào thùng rác/);
  });
});

// Consolidated from fe/tests/soft-delete-contract.test.mjs; audit 2026-11-07.
{
// Soft delete / trash contracts (source-level, same style as the other admin contracts).
// Run: node --test tests/trash-people-contract.test.mjs   (from the fe/ directory)

const { describe, it } = await import("node:test");
const { default: assert } = await import("node:assert/strict");
const { readFileSync } = await import("node:fs");

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const trashPage = read("src/app/quan-tri/thung-rac/page.tsx");
const trashClient = read("src/lib/admin-trash-client.ts");
const trashBff = read("src/lib/server/admin-trash.ts");
const catalogBff = read("src/lib/server/admin-catalog.ts");
const catalogClient = read("src/lib/admin-catalog-client.ts");
const shell = read("src/components/admin-b/admin-frame.tsx");
const productPage = read("src/app/quan-tri/san-pham/[id]/page.tsx");
const categoryPage = read("src/app/quan-tri/danh-muc/page.tsx");
const deletePanel = read("src/components/admin-b/delete-reason-panel.tsx");

describe("thùng rác: trang và điều hướng", () => {
  it("nằm trong nhóm Hệ thống của admin shell", () => {
    assert.match(shell, /Thùng rác/);
    assert.match(shell, /href: "\/quan-tri\/thung-rac"/);
    assert.match(shell, /label: "Hệ thống"[\s\S]*Thùng rác/);
  });


  it("hiển thị người xóa, thời điểm, lý do, trạng thái và nút khôi phục có xác nhận", () => {
    for (const column of ["Tên", "Xóa lúc", "Người xóa", "Lý do", "Trạng thái", "Thao tác"]) {
      assert.ok(trashPage.includes(column), column);
    }
    assert.match(trashPage, /Khôi phục/);
    assert.match(trashPage, /<ConfirmDialog/);
  });


  it("nói thật về trạng thái sau khôi phục và không có nút xóa vĩnh viễn", () => {
    assert.match(trashPage, /Ngừng kinh doanh/);
    assert.match(trashPage, /Chưa Publish/);
    assert.match(trashPage, /không có xóa vĩnh viễn/i);
    assert.doesNotMatch(trashPage, /xóa vĩnh viễn<\/button>/i);
    assert.doesNotMatch(trashPage, /method: "DELETE"/);
  });

  it("dòng thiếu người xóa hiển thị Hệ thống", () => {
    assert.match(trashClient, /deletedByLabel/);
    assert.match(trashClient, /return trimmed \? trimmed : "Hệ thống"/);
  });
});

describe("BFF thùng rác", () => {
  it("có auth admin và hai nhóm route đọc/khôi phục", () => {
    assert.match(trashBff, /adminIdentity/);
    assert.match(trashBff, /\/api\/v1\/admin\/trash\/\$\{kind\}/);
    assert.match(trashBff, /\/restore/);
  });

  it("khôi phục qua kiểm tra origin + JSON và chỉ chuyển tiếp thông báo guard của BE", () => {
    assert.match(trashBff, /requireJsonPost/);
    assert.match(trashBff, /MIN: 4401, MAX: 4408/);
    assert.match(trashBff, /Không tìm thấy mục này trong thùng rác/);
  });

  it("client không bao giờ gọi xóa vĩnh viễn", () => {
    assert.doesNotMatch(trashClient, /purge|hard-delete|permanent/i);
    assert.match(trashClient, /restoreTrashItem/);
  });
});

describe("xóa có lý do ở các trang hiện có", () => {
  it("panel xóa hỏi lý do tối đa 255 ký tự và nêu hậu quả", () => {
    assert.match(deletePanel, /maxLength=\{255\}/);
    assert.match(deletePanel, /<AdminModal/); // hộp thoại native <dialog>, role dialog ngầm định
    assert.match(deletePanel, /thùng rác/);
  });

  it("sản phẩm: xóa có lý do, từ chối hiển thị trong hộp thoại, có Ngừng kinh doanh thay thế", () => {
    assert.match(productPage, /DeleteReasonPanel/);
    assert.match(productPage, /deleteProduct\(id, reason\)/);
    assert.match(productPage, /deleteVariant\(deleteTarget\.id, reason\)/);
    assert.match(productPage, /Ngừng kinh doanh/);
    assert.doesNotMatch(productPage, /Không thể hoàn tác/);
    assert.doesNotMatch(productPage, /Xóa \(ngừng kinh doanh\)/);
  });

  it("danh mục: xóa có lý do và từ chối hiển thị inline", () => {
    assert.match(categoryPage, /DeleteReasonPanel/);
    assert.match(categoryPage, /deleteCategory\(deleteTarget\.id, reason\)/);
    assert.doesNotMatch(categoryPage, /window\.confirm/);
  });

  it("client gửi lý do bằng JSON cho cả ba loại xóa", () => {
    for (const name of ["deleteProduct", "deleteVariant", "deleteCategory"]) {
      const line = catalogClient.split("\n").find((row) => row.includes(`export async function ${name}(`)) ?? "";
      assert.match(line, /reason/, name);
      assert.match(line, /"content-type": "application\/json"/, name);
    }
  });

  it("BFF xóa không chuyển nguyên văn chuỗi lỗi của BE, trừ thông báo guard 4401-4408", () => {
    assert.match(catalogBff, /catalogDeleteWithReason/);
    assert.match(catalogBff, /4401/);
    assert.match(catalogBff, /4408/);
    assert.match(catalogBff, /Không tìm thấy dữ liệu cần xóa/);
  });
});

}
