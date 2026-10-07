import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import { AccountShell } from "@/components/account/account-shell";
import styles from "@/components/account/account.module.css";
import { ProfileEditor } from "./profile-editor";

export const metadata = {
  title: "FaSearch — Thông tin cá nhân",
  description: "Xem và đổi tên hiển thị FaSearch.",
};

export default function ProfilePage() {
  return (
    <div>
      <SiteHeader />
      <main className={styles.layout}>
        <AccountShell
          active="profile"
          kicker="Tài khoản của tôi"
          title="Thông tin cá nhân"
          lede="Tên đăng nhập và email chỉ đọc. Chỉ tên hiển thị được sửa."
          crumb="Thông tin cá nhân"
        >
          <section className={styles.card} aria-label="Form thông tin cá nhân">
            <ProfileEditor />
          </section>
        </AccountShell>
      </main>
      <SiteFooter />
    </div>
  );
}
