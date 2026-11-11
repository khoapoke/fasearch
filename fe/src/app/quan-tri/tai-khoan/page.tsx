import { redirect } from "next/navigation";

// So sánh năng lực (CONTROL-SCOPE-CLARIFICATIONS #2): 5 thao tác cũ của /quan-tri/tai-khoan
// (list/khóa-mở-khóa/reset-password/create/PATCH) đều đi qua proxy /api/be, proxy này đã trả 410
// Gone trong integrated demo — không còn endpoint nào phục vụ chúng. Trang /quan-tri/tai-khoan-noi-bo
// đã có AccountForm tạo/sửa đầy đủ, bảo vệ anti-self-demote, không có CUSTOMER provisioning.
// Vì vậy route cũ chuyển hướng canonical, không khôi phục session API cũ.
export default function LegacyAccountsRedirect() {
  redirect("/quan-tri/tai-khoan-noi-bo");
}
