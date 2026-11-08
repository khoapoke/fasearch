// Soft delete / trash contracts (source-level, same style as the other admin contracts).
// Run: node --test tests/soft-delete-contract.test.mjs   (from the fe/ directory)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

  it("có đủ ba tab sản phẩm, biến thể, danh mục", () => {
    for (const label of ["Sản phẩm", "Biến thể", "Danh mục"]) assert.ok(trashPage.includes(label), label);
    for (const kind of ["products", "variants", "categories"]) assert.ok(trashPage.includes(`"${kind}"`), kind);
  });

  it("hiển thị người xóa, thời điểm, lý do, trạng thái và nút khôi phục có xác nhận", () => {
    for (const column of ["Tên", "Xóa lúc", "Người xóa", "Lý do", "Trạng thái", "Thao tác"]) {
      assert.ok(trashPage.includes(column), column);
    }
    assert.match(trashPage, /Khôi phục/);
    assert.match(trashPage, /<ConfirmDialog/);
  });

  it("dùng .table-cards cho bố cục điện thoại và có pager + trạng thái rỗng", () => {
    assert.match(trashPage, /table-cards/);
    assert.match(trashPage, /<Pager/);
    assert.match(trashPage, /Thùng rác trống/);
  });

  it("nói thật về trạng thái sau khôi phục và không có nút xóa vĩnh viễn", () => {
    assert.match(trashPage, /Ngừng kinh doanh/);
    assert.match(trashPage, /Chưa Publish/);
    assert.match(trashPage, /không có xóa vĩnh viễn/i);
    assert.doesNotMatch(trashPage, /xóa vĩnh viễn<\/button>/i);
    assert.doesNotMatch(trashPage, /method: "DELETE"/);
  });

  it("dòng thiếu người xóa hiển thị Không rõ", () => {
    assert.match(trashClient, /deletedByLabel/);
    assert.match(trashClient, /"Không rõ"/);
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
