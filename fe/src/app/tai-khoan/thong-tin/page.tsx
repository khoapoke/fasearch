import Link from "next/link";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { ProfileEditor } from "./profile-editor";

export const metadata = {
  title: "Thông tin tài khoản cá nhân | FashionSearch AI",
  description: "Xem và sửa thông tin cá nhân FaSearch.",
};

export default function ProfilePage() {
  return (
    <AccountCenterShell active="/tai-khoan/thong-tin" title="Thông tin cá nhân">
      <section className="sfSideCard" aria-label="Ảnh đại diện">
        <b>Ảnh đại diện</b>
        <p className="sfIdentitySub" style={{ marginTop: 6 }}>
          Shop chưa hỗ trợ tải ảnh đại diện — tên viết tắt hiển thị ở sidebar.
          Đổi mật khẩu ở <Link href="/tai-khoan/bao-mat" style={{ fontWeight: 700, color: "var(--brand)" }}>Cài đặt &amp; Bảo mật →</Link>
        </p>
      </section>
      <section className="sfSideCard" aria-label="Form thông tin cá nhân">
        <ProfileEditor />
      </section>
    </AccountCenterShell>
  );
}
