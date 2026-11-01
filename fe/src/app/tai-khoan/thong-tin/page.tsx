import Link from "next/link";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { ProfileEditor } from "@/components/customer-auth/profile-editor";

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
          Tên viết tắt của bạn hiển thị ở bảng thông tin bên cạnh.
        </p>
      </section>
      <section className="sfSideCard" aria-label="Form thông tin cá nhân">
        <ProfileEditor />
      </section>
    </AccountCenterShell>
  );
}
