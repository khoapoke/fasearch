import Link from "next/link";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { ProfileEditor } from "@/components/customer-auth/profile-editor";

export const metadata = {
  title: "Thông tin tài khoản cá nhân | FaSearch",
  description: "Xem và sửa thông tin cá nhân FaSearch.",
};

export default function ProfilePage() {
  return (
    <AccountCenterShell active="/tai-khoan/thong-tin" title="Thông tin cá nhân">
      <section aria-label="Thông tin cá nhân">
        <ProfileEditor />
      </section>
    </AccountCenterShell>
  );
}
