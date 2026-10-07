import { SiteFooter } from "@/components/stitch-search/site-footer";
import { SiteHeader } from "@/components/stitch-search/site-header";
import { AccountShell } from "@/components/account/account-shell";
import styles from "@/components/account/account.module.css";
import { PasswordForm } from "./password-form";

export const metadata = {
  title: "FaSearch — Bảo mật tài khoản",
  description: "Đổi mật khẩu FaSearch. Mọi phiên hết hiệu lực sau khi đổi.",
};

export default function SecurityPage() {
  return (
    <div>
      <SiteHeader />
      <main className={styles.layout}>
        <AccountShell
          active="security"
          kicker="Tài khoản của tôi"
          title="Cài đặt tài khoản và bảo mật"
          lede="Đổi mật khẩu bằng mật khẩu hiện tại. Sau khi đổi, mọi phiên đăng nhập khác đều hết hiệu lực."
          crumb="Bảo mật"
        >
          <section className={styles.card} aria-label="Form đổi mật khẩu">
            <PasswordForm />
          </section>
        </AccountShell>
      </main>
      <SiteFooter />
    </div>
  );
}
